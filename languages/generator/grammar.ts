import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import type { LanguageEntry } from './entry.ts';
import { dirPattern, ensureCheckout, filePattern } from './git.ts';
import { type AbiRange, copyTree, parserAbi } from './grammar-files.ts';

export {
  type AbiRange,
  hasScanner,
  parserAbi,
  readAbiRange,
} from './grammar-files.ts';

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
