import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { dirPattern, ensureCheckout, filePattern } from './git.ts';
import type { LanguageEntry } from './manifest.ts';

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

function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (SKIP.has(name)) continue;
    const src = path.join(from, name);
    const dst = path.join(to, name);
    if (statSync(src).isDirectory()) copyTree(src, dst);
    else cpSync(src, dst);
  }
}

/** Checks out the grammar sources at the pinned revision and copies them under <outDir>/grammar. */
export function fetchGrammar(
  entry: LanguageEntry,
  abi: AbiRange,
  outDir: string,
): { grammarDir: string; license: string | null } {
  const extra = entry.extraPaths ?? [];
  const patterns = [
    ...entry.grammars.map((g) => dirPattern(g.src)),
    ...extra.map((p) => (p.endsWith('/') ? dirPattern(p) : filePattern(p))),
    '/LICENSE*',
  ];
  const checkout = ensureCheckout(entry.repo, entry.rev, patterns);
  const grammarDir = path.join(outDir, 'grammar');
  rmSync(grammarDir, { recursive: true, force: true });
  for (const g of entry.grammars) {
    const parserC = path.join(checkout, g.src, 'parser.c');
    const version = parserAbi(parserC);
    if (version < abi.min || version > abi.max) {
      throw new Error(
        `${entry.id}/${g.name}: parser ABI ${version} outside runtime range ${abi.min}..${abi.max}`,
      );
    }
    copyTree(path.join(checkout, g.src), path.join(grammarDir, g.src));
  }
  for (const p of extra) {
    const src = path.join(checkout, p);
    const dst = path.join(grammarDir, p);
    if (statSync(src).isDirectory()) copyTree(src, dst);
    else {
      mkdirSync(path.dirname(dst), { recursive: true });
      cpSync(src, dst);
    }
  }
  const licenseName = readdirSync(checkout).find((n) => n.startsWith('LICENSE'));
  const license = licenseName ? readFileSync(path.join(checkout, licenseName), 'utf8') : null;
  if (licenseName) cpSync(path.join(checkout, licenseName), path.join(grammarDir, 'LICENSE'));
  return { grammarDir, license };
}

export function hasScanner(grammarDir: string, src: string): boolean {
  return existsSync(path.join(grammarDir, src, 'scanner.c'));
}
