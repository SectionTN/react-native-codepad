import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export type AbiRange = { min: number; max: number };

export function readAbiRange(apiHeader: string): AbiRange {
  const text = readFileSync(apiHeader, 'utf8');
  const max = /#define TREE_SITTER_LANGUAGE_VERSION (\d+)/.exec(text);
  const min = /#define TREE_SITTER_MIN_COMPATIBLE_LANGUAGE_VERSION (\d+)/.exec(text);
  if (!max || !min) throw new Error(`cannot read ABI range from ${apiHeader}`);
  return { min: Number(min[1]), max: Number(max[1]) };
}

export function parserAbi(parserC: string): number {
  const head = readFileSync(parserC, 'utf8').slice(0, 2000);
  const m = /#define LANGUAGE_VERSION (\d+)/.exec(head);
  if (!m) throw new Error(`no LANGUAGE_VERSION in ${parserC}`);
  return Number(m[1]);
}

const SKIP = new Set(['grammar.json', 'node-types.json']);

export function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (SKIP.has(name)) continue;
    const src = path.join(from, name);
    const dst = path.join(to, name);
    if (statSync(src).isDirectory()) copyTree(src, dst);
    else cpSync(src, dst);
  }
}

export function hasScanner(grammarDir: string, src: string): boolean {
  return existsSync(path.join(grammarDir, src, 'scanner.c'));
}
