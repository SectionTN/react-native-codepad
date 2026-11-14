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
const languages = new Map<string, Promise<boolean>>();

// The page's one core, injected by a script tag from the assets folder on first use.
export function loadCore(): Promise<CoreModule> {
  if (!core) core = createCore(webAssetsUrl());
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
    manifest = fetchText(`${webAssetsUrl()}languages.json`).then((text) => {
      if (text === null) return null;
      const parsed = JSON.parse(text) as Manifest;
      ids = parsed.languages.map((l) => l.id);
      return parsed;
    });
  }
  return manifest;
}

// Loads a language and every language its injection query names, those first. False, with one warning, when the
// manifest lacks the id or a file does not load: the editor then draws plain text.
export function ensureLanguage(m: CoreModule, id: string): Promise<boolean> {
  return load(m, id, []);
}

function load(m: CoreModule, id: string, chain: string[]): Promise<boolean> {
  let pending = languages.get(id);
  if (!pending) {
    pending = loadLanguage(m, id, [...chain, id]);
    languages.set(id, pending);
  }
  return pending;
}

async function loadLanguage(m: CoreModule, id: string, chain: string[]): Promise<boolean> {
  const base = webAssetsUrl();
  const list = await loadManifest();
  if (!list) return false;
  const entry = list.languages.find((l) => l.id === id);
  if (!entry) {
    console.warn(`[codepad] language "${id}" is not in ${base}languages.json`);
    return false;
  }
  const [wasm, highlights, injections] = await Promise.all([
    fetchBytes(base + entry.wasm),
    entry.highlights ? fetchText(base + entry.highlights) : '',
    entry.injections ? fetchText(base + entry.injections) : '',
  ]);
  if (wasm === null || highlights === null || injections === null) return false;
  const installed = (name: string) => list.languages.some((l) => l.id === name);
  const injected = new Set<string>();
  for (const [, name] of injections.matchAll(INJECTION_LANGUAGE)) {
    const target = canonicalInjectionId(name as string, installed);
    if (target && installed(target) && !chain.includes(target)) injected.add(target);
  }
  await Promise.all([...injected].map((target) => load(m, target, chain)));
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
    return false;
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
  }
  return ok === 1;
}

async function fetchText(url: string): Promise<string | null> {
  const response = await request(url);
  return response ? response.text() : null;
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  const response = await request(url);
  return response ? new Uint8Array(await response.arrayBuffer()) : null;
}

async function request(url: string): Promise<Response | null> {
  try {
    const response = await fetch(url);
    if (response.ok) return response;
    console.warn(`[codepad] could not load ${url}: ${response.status}`);
  } catch (e) {
    console.warn(`[codepad] could not load ${url}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return null;
}
