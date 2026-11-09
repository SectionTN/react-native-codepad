import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LanguageEntry } from './entry.ts';

export { type GrammarEntry, type LanguageEntry, pascal } from './entry.ts';

export type Manifest = {
  runtime: { repo: string; rev: string };
  queries: { repo: string; rev: string };
  languages: LanguageEntry[];
};

export const generatorDir = path.dirname(fileURLToPath(import.meta.url));
export const languagesDir = path.resolve(generatorDir, '..');
export const repoRoot = path.resolve(languagesDir, '..');
export const cacheDir = path.join(languagesDir, '.cache');

export function loadManifest(): Manifest {
  return JSON.parse(readFileSync(path.join(languagesDir, 'grammars.json'), 'utf8')) as Manifest;
}
