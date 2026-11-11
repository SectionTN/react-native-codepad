import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureNames } from './captures.ts';
import { emitPackage, type GrammarQueries } from './emit.ts';
import { pascal } from './entry.ts';
import { copyTree, parserAbi, readAbiRange } from './grammar-files.ts';
import { languageSymbol } from './host.ts';
import { parseInherits } from './queries.ts';
import { rewriteQuery } from './rewrite.ts';

/** A grammar folder, an id or an output folder the command refuses, with the reason for the user. */
export class CustomLanguageError extends Error {}

/** Every id and grammar name in grammars.json: a custom package with one of them would clash with ours. */
export const SHIPPED_IDS: readonly string[] = [
  'c',
  'css',
  'dtd',
  'go',
  'html',
  'ini',
  'java',
  'javascript',
  'json',
  'kotlin',
  'markdown',
  'markdown_inline',
  'php',
  'php_only',
  'python',
  'rust',
  'sql',
  'swift',
  'tsx',
  'typescript',
  'xml',
  'yaml',
];

// The id is an Android package segment, and autolinking imports it from generated Java.
const RESERVED = new Set(
  [
    'as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while',
    'abstract assert boolean byte case catch char const default double enum extends final finally float goto implements import instanceof int long native new private protected public short static strictfp switch synchronized throws transient void volatile',
  ]
    .join(' ')
    .split(' '),
);
const INCLUDE = /^\s*#\s*include\s*"([^"]+)"/gm;
const ID = /^[a-z][a-z0-9_]*$/;
const GENERATED_DIRS = ['android', 'ios', 'queries', 'src', 'grammar'];
const GUIDE = 'https://reactnativecodepad.pages.dev/guides/custom-languages/';

// languages/generator in the repo and lib/cli in the package both sit two levels under the core root.
const defaultCoreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export type CustomOptions = {
  grammarDir: string;
  outDir?: string;
  id?: string;
  name?: string;
  cwd?: string;
  coreRoot?: string;
};

export type CustomResult = { id: string; npmName: string; outDir: string };

function fail(message: string): never {
  throw new CustomLanguageError(message);
}

function readIfExists(file: string): string | null {
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

function readJson(file: string): Record<string, unknown> | null {
  const text = readIfExists(file);
  if (text == null) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** npm allows an author object; the podspec reads one string. */
function authorString(author: unknown): string | undefined {
  if (typeof author === 'string') return author;
  if (author == null || typeof author !== 'object') return undefined;
  const { name, email, url } = author as { name?: string; email?: string; url?: string };
  if (!name) return undefined;
  return [name, email && `<${email}>`, url && `(${url})`].filter(Boolean).join(' ');
}

function customQuery(file: string, rel: string, injections: boolean): string {
  const src = readFileSync(file, 'utf8');
  if (parseInherits(src).parents.length > 0) {
    fail(
      `${rel} uses "; inherits:", which a local grammar cannot resolve. Copy the parent query into it.`,
    );
  }
  let result: ReturnType<typeof rewriteQuery>;
  try {
    result = rewriteQuery(src, { injections });
  } catch (e) {
    fail(`${rel}: ${(e as Error).message}`);
  }
  if (result.dropped.length > 0) {
    const lines = result.dropped.map((d) => `  ${d.pattern.text.split('\n')[0]}: ${d.reason}`);
    fail(`${rel} has patterns react-native-codepad cannot run:\n${lines.join('\n')}`);
  }
  return result.text;
}

/** The first quoted include under src that resolves outside it, since the package copies src only. */
function outsideInclude(src: string, dir = src): { file: string; include: string } | null {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) {
      const found = outsideInclude(src, file);
      if (found) return found;
      continue;
    }
    if (!/\.(c|h|inc)$/.test(name)) continue;
    for (const [, include] of readFileSync(file, 'utf8').matchAll(INCLUDE)) {
      const target = path.relative(src, path.resolve(dir, include!));
      if (target === '..' || target.startsWith(`..${path.sep}`) || path.isAbsolute(target)) {
        return { file: path.relative(src, file), include: include! };
      }
    }
  }
  return null;
}

/** Clears what an earlier run wrote, and refuses a folder this command did not write. */
function prepareOut(outDir: string): void {
  if (!existsSync(outDir) || readdirSync(outDir).length === 0) return;
  const pkg = readJson(path.join(outDir, 'package.json'));
  const codepad = pkg?.codepad as { generated?: unknown } | undefined;
  if (codepad?.generated !== true) {
    fail(`${outDir} exists and was not generated by this command. Choose another --out.`);
  }
  for (const name of GENERATED_DIRS)
    rmSync(path.join(outDir, name), { recursive: true, force: true });
  for (const name of readdirSync(outDir)) {
    if (name.endsWith('.podspec')) rmSync(path.join(outDir, name));
  }
}

function readme(npmName: string, id: string, highlights: string): string {
  const keys = captureNames(highlights).map((n) => `- \`${n}\``);
  return `# ${npmName}

Generated by \`npx react-native-codepad language\`. Do not edit it by hand: change the grammar or its queries and run the command again.

Pass \`language="${id}"\` to \`CodeEditor\`. Theme token keys this package produces:

${keys.join('\n')}

See the [custom languages guide](${GUIDE}).
`;
}

/** Builds a language package for react-native-codepad from a tree-sitter grammar folder. */
export function emitCustomLanguage(opts: CustomOptions): CustomResult {
  const cwd = opts.cwd ?? process.cwd();
  const coreRoot = opts.coreRoot ?? defaultCoreRoot;
  const core = String(readJson(path.join(coreRoot, 'package.json'))?.version);
  const grammarDir = path.resolve(cwd, opts.grammarDir);
  const src = path.join(grammarDir, 'src');

  const parserC = path.join(src, 'parser.c');
  if (!existsSync(parserC)) {
    fail(`${parserC} not found. Run tree-sitter generate in the grammar folder first.`);
  }
  const symbol = languageSymbol(readFileSync(parserC, 'utf8'));
  if (!symbol)
    fail('src/parser.c has no tree_sitter_<name> function. Is it tree-sitter generate output?');
  // iOS links every language pod statically, so two grammars with one C name share a parser.
  if (SHIPPED_IDS.includes(symbol)) {
    fail(
      `src/parser.c defines tree_sitter_${symbol}, the same function as a language react-native-codepad ships. Rename the grammar in grammar.js and run tree-sitter generate again.`,
    );
  }
  if (!existsSync(path.join(src, 'tree_sitter/parser.h'))) {
    fail(
      'src/tree_sitter/parser.h not found. Keep the tree_sitter folder that tree-sitter generate writes.',
    );
  }
  if (existsSync(path.join(src, 'scanner.cc'))) {
    fail('src/scanner.cc is C++. Only a C scanner, src/scanner.c, is supported.');
  }
  const outside = outsideInclude(src);
  if (outside) {
    fail(
      `src/${outside.file} includes "${outside.include}" from outside src/. Move that file into src/.`,
    );
  }
  const abi = readAbiRange(path.join(coreRoot, 'cpp/tree-sitter/lib/include/tree_sitter/api.h'));
  const version = parserAbi(parserC);
  if (version < abi.min || version > abi.max) {
    fail(
      `src/parser.c has ABI ${version}, and react-native-codepad ${core} loads ABI ${abi.min} to ${abi.max}. Regenerate it with tree-sitter 0.26.`,
    );
  }

  const id = opts.id ?? symbol;
  if (!ID.test(id)) {
    fail(
      `id "${id}" must start with a lowercase letter and hold only lowercase letters, digits and underscores.`,
    );
  }
  if (RESERVED.has(id))
    fail(`id "${id}" is a Kotlin or Java keyword and cannot name the Android package.`);
  if (SHIPPED_IDS.includes(id))
    fail(`id "${id}" is a language react-native-codepad ships. Pass another --id.`);

  const highlightsFile = path.join(grammarDir, 'queries/highlights.scm');
  if (!existsSync(highlightsFile)) fail('queries/highlights.scm not found.');
  const injectionsFile = path.join(grammarDir, 'queries/injections.scm');
  const queries: GrammarQueries = {
    highlights: customQuery(highlightsFile, 'queries/highlights.scm', false),
    injections: existsSync(injectionsFile)
      ? customQuery(injectionsFile, 'queries/injections.scm', true)
      : null,
    locals: null,
    indents: null,
  };

  const npmName = opts.name ?? `codepad-lang-${id}`;
  const outDir = path.resolve(cwd, opts.outDir ?? path.join('modules', `codepad-lang-${id}`));
  prepareOut(outDir);
  copyTree(src, path.join(outDir, 'grammar/src'));

  const grammarPkg = readJson(path.join(grammarDir, 'package.json')) ?? {};
  const author = authorString(grammarPkg.author);
  const packageJson: Record<string, unknown> = {
    name: npmName,
    version: typeof grammarPkg.version === 'string' ? grammarPkg.version : '0.0.0',
    description: `tree-sitter ${pascal(id)} grammar for react-native-codepad`,
    private: true,
    license: 'UNLICENSED',
    ...(author ? { author } : {}),
    main: './src/index.ts',
    types: './src/index.ts',
    files: [
      'src',
      'android',
      'ios',
      'grammar',
      'queries',
      '*.podspec',
      '!android/build',
      '!android/.cxx',
    ],
    keywords: ['react-native', 'codepad', 'tree-sitter', id],
    peerDependencies: { 'react-native-codepad': `^${core}` },
    codepad: { generated: true, core },
  };
  emitPackage({
    entry: { id, grammars: [{ name: id, src: 'src', symbol }] },
    version: core,
    outDir,
    grammarDir: path.join(outDir, 'grammar'),
    queries: { [id]: queries },
    identity: {
      packageJson,
      readme: readme(npmName, id, queries.highlights ?? ''),
      notices: null,
      podSource: '{ :git => "" }',
      podFallbacks: true,
    },
  });
  return { id, npmName, outDir };
}
