import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type QueryKind = 'highlights' | 'injections' | 'locals' | 'indents';
export const QUERY_KINDS: QueryKind[] = ['highlights', 'injections', 'locals', 'indents'];
export type QueryReader = (lang: string, kind: QueryKind) => string | null;

export function parseInherits(src: string): { parents: string[]; body: string } {
  const lines = src.split('\n');
  const parents: string[] = [];
  let i = 0;
  while (i < lines.length && /^;+\s*(inherits:|extends\b)/.test(lines[i]!)) {
    const m = /^;+\s*inherits:\s*(.*)$/.exec(lines[i]!);
    if (m) parents.push(...m[1]!.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^\((.*)\)$/, '$1')));
    i++;
  }
  return { parents, body: lines.slice(i).join('\n') };
}

export function resolveQuery(lang: string, kind: QueryKind, read: QueryReader, seen: Set<string> = new Set()): string | null {
  if (seen.has(lang)) return '';
  seen.add(lang);
  const src = read(lang, kind);
  if (src == null) return null;
  const { parents, body } = parseInherits(src);
  const parts: string[] = [];
  for (const parent of parents) {
    const text = resolveQuery(parent, kind, read, seen);
    if (text) parts.push(`; inherited from ${parent}`, text);
  }
  parts.push(body);
  return parts.join('\n');
}

export function checkoutReader(dir: string): QueryReader {
  return (lang, kind) => {
    const file = path.join(dir, 'runtime', 'queries', lang, `${kind}.scm`);
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
  };
}

// Parents are only known after reading a file, so collect them by walking the modelines.
export function collectQueryLangs(dir: string, roots: string[]): string[] {
  const read = checkoutReader(dir);
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const lang = stack.pop()!;
    if (seen.has(lang)) continue;
    seen.add(lang);
    for (const kind of QUERY_KINDS) {
      const src = read(lang, kind);
      if (src) stack.push(...parseInherits(src).parents);
    }
  }
  return [...seen].sort();
}
