// Loads a built WASM core into jest, for the tests under src/web/__tests__.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

export const ROOT = join(__dirname, '..', '..');

export type RawCore = {
  FS: { writeFile(path: string, data: Uint8Array): void };
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAP32: Int32Array;
  _malloc(size: number): number;
  _free(ptr: number): void;
  stringToNewUTF8(s: string): number;
  UTF8ToString(ptr: number): string;
  _cpw_language_load(
    id: number,
    path: number,
    symbol: number,
    highlights: number,
    injections: number,
  ): number;
  _cpw_error(): number;
  _cpw_open(text: number, length: number, budgetMicros: bigint): number;
  _cpw_close(e: number): void;
  _cpw_set_language(e: number, id: number): number;
  _cpw_snapshot(e: number): number;
  _cpw_pump(budgetMs: number): number;
  _cp_highlight(
    snapshot: number,
    first: number,
    last: number,
    start: number,
    out: number,
    cap: number,
  ): number;
  _cp_style_id(name: number): number;
};

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

function query(pkg: string, grammar: string, name: string): string {
  const path = join(ROOT, 'languages', pkg, 'queries', grammar, `${name}.scm`);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

// Writes a grammar side module into the module's files and registers it under id.
export function loadGrammar(m: RawCore, wasm: string, id: string, pkg: string): void {
  const path = `/${id}.so`;
  m.FS.writeFile(path, readFileSync(wasm));
  const ok = cstring(m, id, (idp) =>
    cstring(m, path, (pathp) =>
      cstring(m, `tree_sitter_${id}`, (sym) =>
        cstring(m, query(pkg, id, 'highlights'), (hl) =>
          cstring(m, query(pkg, id, 'injections'), (inj) =>
            m._cpw_language_load(idp, pathp, sym, hl, inj),
          ),
        ),
      ),
    ),
  );
  if (ok !== 1) throw new Error(`${id}: ${m.UTF8ToString(m._cpw_error())}`);
}

export function pumpAll(m: RawCore, budgetMs = 8): void {
  for (let i = 0; i < 100000 && m._cpw_pump(budgetMs) > 0; i++);
}
