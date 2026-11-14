// Names nvim queries and fence info strings use for languages shipped under another id. Empty means never inject.
// The same table as LanguageRegistry.kt and LanguageRegistry.swift.
export const INJECTION_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  py: 'python',
  python3: 'python',
  kt: 'kotlin',
  kts: 'kotlin',
  rs: 'rust',
  golang: 'go',
  yml: 'yaml',
  jsonc: 'json',
  json5: 'json',
  htm: 'html',
  xhtml: 'html',
  md: 'markdown',
  h: 'c',
  svg: 'xml',
  xsd: 'xml',
  xsl: 'xml',
  xslt: 'xml',
  rng: 'xml',
  dosini: 'ini',
  confini: 'ini',
  cpp: '',
  'c++': '',
  cc: '',
  hpp: '',
  objc: '',
  bash: '',
  sh: '',
  shell: '',
  zsh: '',
  console: '',
  text: '',
  txt: '',
  plain: '',
  regex: '',
  jsdoc: '',
  phpdoc: '',
  comment: '',
  luap: '',
  printf: '',
  styled: '',
  angular: '',
  groq: '',
  graphql: '',
  glimmer: '',
  sql: '',
  c_sharp: '',
});

// Lowercases a fence or query name. An installed id wins over the aliases, null means never inject.
export function canonicalInjectionId(
  name: string,
  installed: (id: string) => boolean,
): string | null {
  const lower = name.toLowerCase();
  if (!Object.hasOwn(INJECTION_ALIASES, lower)) return lower;
  if (installed(lower)) return lower;
  const mapped = INJECTION_ALIASES[lower] as string;
  return mapped === '' ? null : mapped;
}
