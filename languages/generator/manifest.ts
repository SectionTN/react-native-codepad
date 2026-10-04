import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type GrammarEntry = { name: string; src: string };
export type LanguageEntry = {
  id: string;
  repo: string;
  rev: string;
  grammars: GrammarEntry[];
  extraPaths?: string[];
};
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

export function pascal(id: string): string {
  return id
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}
