/// <reference lib="dom" />
import { canonicalInjectionId, INJECTION_ALIASES } from './aliases';
import { webAssetsUrl } from './configure';
import { type CoreModule, withCString } from './core/module';
import { setPumpCore } from './pump';

// languages.json, as the web command writes it.
type ManifestLanguage = {
  id: string;
  wasm: string;
  symbol: string;
  highlights: string | null;
  injections: string | null;
};
type Manifest = { version: 1; languages: ManifestLanguage[] };

type CreateCore = (options: { locateFile(file: string): string }) => Promise<CoreModule>;

const INJECTION_LANGUAGE = /#set!\s+injection\.language\s+"([^"]+)"/g;

let core: Promise<CoreModule> | null = null;
let manifest: Promise<Manifest | null> | null = null;
let ids: string[] = [];
// Each language registered on its own, resolving to the ids its injection query names, or null when it failed.
const languages = new Map<string, Promise<string[] | null>>();
const registered = new Set<(id: string) => void>();

// Calls the listener with each language id the first time it registers, and returns its removal.
export function onRegistered(listener: (id: string) => void): () => void {
  registered.add(listener);
  return () => {
    registered.delete(listener);
  };
}

// Loads the installed languages that injection names map to, and resolves with the ids now registered.
export async function ensureInjected(m: CoreModule, names: string[]): Promise<string[]> {
  const list = await loadManifest().catch(() => null);
  if (!list) return [];
  const installed = (id: string) => list.languages.some((l) => l.id === id);
  const ids = new Set<string>();
  for (const name of names) {
    const id = canonicalInjectionId(name, installed);
    if (id && installed(id)) ids.add(id);
  }
  const loaded = await Promise.all([...ids].map((id) => ensureLanguage(m, id)));
  return [...ids].filter((_, i) => loaded[i]);
}

// The page's one core, injected by a script tag from the assets folder on first use.
export function loadCore(): Promise<CoreModule> {
  if (!core) {
    const pending = createCore(webAssetsUrl());
    core = pending;
    // A failed load is not kept, so the next editor tries again.
    pending.catch(() => {
      if (core === pending) core = null;
    });
  }
  return core;
}

async function createCore(base: string): Promise<CoreModule> {
  const g = globalThis as { createCodepadCore?: CreateCore };
  if (!g.createCodepadCore) await injectScript(`${base}codepad.js`);
  if (!g.createCodepadCore) throw new Error(`[codepad] ${base}codepad.js did not define the core`);
  const m = await g.createCodepadCore({ locateFile: (file) => base + file });
  for (const [name, id] of Object.entries(INJECTION_ALIASES)) {
    withCString(m, name, (n) => withCString(m, id, (i) => m._cpw_language_alias(n, i)));
  }
  setPumpCore(m);
  return m;
}

function injectScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`[codepad] could not load ${url}`));
    document.head.appendChild(script);
  });
}

// The ids in languages.json once it loaded, empty before.
export function availableLanguages(): string[] {
  return [...ids];
}

function loadManifest(): Promise<Manifest | null> {
  if (!manifest) {
    const url = `${webAssetsUrl()}languages.json`;
    manifest = fetchText(url).then(
      (text) => {
        if (text === null) return null;
        const parsed = parseManifest(text);
        if (!parsed) {
          console.warn(
            `[codepad] ${url} is not the file the web command writes. Run npx react-native-codepad web <public-dir>.`,
          );
          return null;
        }
        ids = parsed.languages.map((l) => l.id);
        return parsed;
      },
      (e: unknown) => {
        manifest = null;
        throw e;
      },
    );
  }
  return manifest;
}

// A dev server answers a missing file with its index page, so the text may not be JSON at all.
function parseManifest(text: string): Manifest | null {
  try {
    const parsed = JSON.parse(text) as Partial<Manifest> | null;
    return Array.isArray(parsed?.languages) ? (parsed as Manifest) : null;
  } catch {
    return null;
  }
}

// True once the language and all it injects, at any depth, are registered. False and one warning when it fails.
export async function ensureLanguage(m: CoreModule, id: string): Promise<boolean> {
  const seen = new Set([id]);
  const host = loadOne(m, id);
  let wave = [host];
  while (wave.length > 0) {
    const next: Promise<string[] | null>[] = [];
    for (const names of await Promise.all(wave)) {
      for (const name of names ?? []) {
        if (seen.has(name)) continue;
        seen.add(name);
        next.push(loadOne(m, name));
      }
    }
    wave = next;
  }
  return (await host) !== null;
}

// Registers one language without waiting for the ones it injects: the engine resolves those when it parses.
function loadOne(m: CoreModule, id: string): Promise<string[] | null> {
  let pending = languages.get(id);
  if (!pending) {
    // A network error is not kept, so a later editor retries. A 404 or a missing id stays, warned once.
    pending = loadLanguage(m, id).catch((e: unknown) => {
      if (!(e instanceof Offline)) throw e;
      languages.delete(id);
      return null;
    });
    languages.set(id, pending);
  }
  return pending;
}

async function loadLanguage(m: CoreModule, id: string): Promise<string[] | null> {
  const base = webAssetsUrl();
  const list = await loadManifest();
  if (!list) return null;
  const entry = list.languages.find((l) => l.id === id);
  if (!entry) {
    console.warn(`[codepad] language "${id}" is not in ${base}languages.json`);
    return null;
  }
  const [wasm, highlights, injections] = await Promise.all([
    fetchBytes(base + entry.wasm),
    entry.highlights ? fetchText(base + entry.highlights) : '',
    entry.injections ? fetchText(base + entry.injections) : '',
  ]);
  if (wasm === null || highlights === null || injections === null) return null;
  const installed = (name: string) => list.languages.some((l) => l.id === name);
  const injected = new Set<string>();
  for (const [, name] of injections.matchAll(INJECTION_LANGUAGE)) {
    const target = canonicalInjectionId(name as string, installed);
    if (target && target !== id && installed(target)) injected.add(target);
  }
  const path = `/${id}.so`;
  const compiled = await new Promise<boolean>((resolve) =>
    m.FS.createPreloadedFile(
      '/',
      `${id}.so`,
      wasm,
      true,
      false,
      () => resolve(true),
      () => resolve(false),
    ),
  );
  if (!compiled) {
    console.warn(`[codepad] could not compile ${base}${entry.wasm}`);
    return null;
  }
  const ok = withCString(m, id, (i) =>
    withCString(m, path, (p) =>
      withCString(m, entry.symbol, (s) =>
        withCString(m, highlights, (h) =>
          withCString(m, injections, (j) => m._cpw_language_load(i, p, s, h, j)),
        ),
      ),
    ),
  );
  if (ok !== 1) {
    console.warn(
      `[codepad] could not load ${base}${entry.wasm}: ${m.UTF8ToString(m._cpw_error())}`,
    );
    return null;
  }
  for (const listener of [...registered]) listener(id);
  return [...injected];
}

async function fetchText(url: string): Promise<string | null> {
  const response = await request(url);
  return response ? readBody(url, () => response.text()) : null;
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  const response = await request(url);
  return response ? new Uint8Array(await readBody(url, () => response.arrayBuffer())) : null;
}

// A body cut off by the network is a network error too.
async function readBody<T>(url: string, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (e) {
    throw offline(url, e);
  }
}

// A fetch that never reached the server, which a later load may get past.
class Offline extends Error {}

// Warns once for the url and returns the error a later load may get past.
function offline(url: string, e: unknown): Offline {
  const message = `[codepad] could not load ${url}: ${e instanceof Error ? e.message : String(e)}`;
  console.warn(message);
  return new Offline(message);
}

// The response, or null after a warning for an HTTP error. Throws Offline after a warning for a network error.
async function request(url: string): Promise<Response | null> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (e) {
    throw offline(url, e);
  }
  if (response.ok) return response;
  console.warn(`[codepad] could not load ${url}: ${response.status}`);
  return null;
}
