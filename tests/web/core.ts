// Loads a built WASM core into jest, for the tests under src/web/__tests__.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

export const ROOT = join(__dirname, '..', '..');

import type { CoreModule } from '../../src/web/core/module';

export type RawCore = CoreModule;

// The folder holding codepad.js and codepad.wasm, or null with a warning when it is not built.
export function builtCore(dir: string, hint: string): string | null {
  const path = join(ROOT, dir);
  if (existsSync(join(path, 'codepad.wasm'))) return path;
  console.warn(`${dir} not built, run ${hint}`);
  return null;
}

// Node's own require, so jest neither transforms the glue nor runs it in its sandbox.
export async function loadCore(dir: string): Promise<RawCore> {
  const create = createRequire(__filename)(join(dir, 'codepad.js')) as () => Promise<RawCore>;
  return create();
}

export function cstring<T>(m: RawCore, s: string, use: (ptr: number) => T): T {
  const ptr = m.stringToNewUTF8(s);
  try {
    return use(ptr);
  } finally {
    m._free(ptr);
  }
}

export function utf16<T>(m: RawCore, s: string, use: (ptr: number, length: number) => T): T {
  const ptr = m._malloc(Math.max(2, s.length * 2));
  for (let i = 0; i < s.length; i++) m.HEAPU16[(ptr >> 1) + i] = s.charCodeAt(i);
  try {
    return use(ptr, s.length);
  } finally {
    m._free(ptr);
  }
}

function query(dir: string, name: string): string {
  const path = join(dir, `${name}.scm`);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

// Writes a grammar side module into the module's files and registers it with the queries in queries.
export function loadGrammar(m: RawCore, wasm: string, id: string, queries: string): void {
  const path = `/${id}.so`;
  m.FS.writeFile(path, readFileSync(wasm));
  const ok = cstring(m, id, (idp) =>
    cstring(m, path, (pathp) =>
      cstring(m, `tree_sitter_${id}`, (sym) =>
        cstring(m, query(queries, 'highlights'), (hl) =>
          cstring(m, query(queries, 'injections'), (inj) =>
            m._cpw_language_load(idp, pathp, sym, hl, inj),
          ),
        ),
      ),
    ),
  );
  if (ok !== 1) throw new Error(`${id}: ${m.UTF8ToString(m._cpw_error())}`);
}

export type WebGrammar = { grammar: string; wasm: string; queries: string };

// Every built grammar module in languages and in the example's custom packages.
export function webGrammars(): WebGrammar[] {
  const out: WebGrammar[] = [];
  for (const base of ['languages', 'example/modules']) {
    for (const pkg of readdirSync(join(ROOT, base)).sort()) {
      const web = join(ROOT, base, pkg, 'web');
      if (!existsSync(web)) continue;
      for (const file of readdirSync(web).filter((f) => f.endsWith('.wasm'))) {
        const grammar = file.slice(0, -5);
        out.push({
          grammar,
          wasm: join(web, file),
          queries: join(ROOT, base, pkg, 'queries', grammar),
        });
      }
    }
  }
  return out;
}

// The injection aliases of LanguageRegistry.kt, the table native resolves fence and query names with.
export function kotlinAliases(): Record<string, string> {
  const kt = readFileSync(
    join(ROOT, 'android/src/main/java/me/sectiontn/codepad/syntax/LanguageRegistry.kt'),
    'utf8',
  );
  const body = kt.slice(
    kt.indexOf('aliases = mapOf('),
    kt.indexOf(')\n', kt.indexOf('aliases = mapOf(')),
  );
  const out: Record<string, string> = {};
  for (const [, name, id] of body.matchAll(/"([^"]+)" to "([^"]*)"/g))
    out[name as string] = id as string;
  return out;
}

export function styleName(m: RawCore, id: number): string {
  const out = m._malloc(256);
  const length = m._cp_style_name(id, out, 256);
  const name = m.UTF8ToString(out).slice(0, length);
  m._free(out);
  return name;
}

// Each line's (start column, end column, style id) triples for lines first..last.
export function highlight(
  m: RawCore,
  snapshot: number,
  first: number,
  last: number,
  start: number,
): number[][] {
  let cap = 4096;
  let out = m._malloc(cap * 4);
  let count = m._cp_highlight(snapshot, first, last, start, out, cap);
  if (count > cap) {
    m._free(out);
    cap = count;
    out = m._malloc(cap * 4);
    count = m._cp_highlight(snapshot, first, last, start, out, cap);
  }
  const ints = m.HEAP32.subarray(out >> 2, (out >> 2) + count);
  const lines: number[][] = [];
  let i = 0;
  for (let line = first; line <= last; line++) {
    const n = i < count ? (ints[i++] as number) : 0;
    lines.push(Array.from(ints.subarray(i, i + n * 3)));
    i += n * 3;
  }
  m._free(out);
  return lines;
}

export function pumpAll(m: RawCore, budgetMs = 8): void {
  for (let i = 0; i < 100000 && m._cpw_pump(budgetMs) > 0; i++);
}
