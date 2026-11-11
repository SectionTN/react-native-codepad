export type GrammarEntry = { name: string; src: string; symbol?: string };
export type LanguageEntry = {
  id: string;
  repo: string;
  rev: string;
  grammars: GrammarEntry[];
  extraPaths?: string[];
  /** SPDX id of the grammar's license when it is not MIT. */
  license?: string;
};

export function pascal(id: string): string {
  return id
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}
