import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type WebLanguage = {
  id: string;
  wasm: string;
  symbol: string;
  highlights: string | null;
  injections: string | null;
};

export type WebManifest = {
  version: 1;
  core: { js: 'codepad.js'; wasm: 'codepad.wasm' };
  languages: WebLanguage[];
};

export class WebAssetsError extends Error {}

type Json = Record<string, unknown>;

function readJson(file: string): Json | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Json;
  } catch {
    return null;
  }
}

// The folder of an installed package, looked up through node_modules from dir upward like Node does.
function packageDir(name: string, from: string): string | null {
  for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

// The web core this command ships with: lib/web next to lib/cli, or the repo's lib/web when run from source.
function ownCore(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const built = path.join(here, '..', 'web');
  return existsSync(path.join(built, 'codepad.wasm'))
    ? built
    : path.join(here, '..', '..', 'lib', 'web');
}

// Every language package of the app: its dependencies, then the custom packages in its modules folder.
function languagePackages(appRoot: string): { name: string; dir: string }[] {
  const pkg = readJson(path.join(appRoot, 'package.json'));
  if (!pkg) throw new WebAssetsError(`${appRoot} has no package.json`);
  const out: { name: string; dir: string }[] = [];
  for (const name of Object.keys((pkg.dependencies as Json | undefined) ?? {})) {
    const dir = packageDir(name, appRoot);
    if (dir && readJson(path.join(dir, 'package.json'))?.codepad) out.push({ name, dir });
  }
  const modules = path.join(appRoot, 'modules');
  for (const entry of existsSync(modules) ? readdirSync(modules).sort() : []) {
    const dir = path.join(modules, entry);
    const json = readJson(path.join(dir, 'package.json'));
    if (json?.codepad) out.push({ name: (json.name as string | undefined) ?? entry, dir });
  }
  return out;
}

// Copies the web core and every installed language with its queries into <publicDir>/codepad, and writes the
// languages.json the browser loader reads.
export function copyWebAssets(
  appRoot: string,
  publicDir: string,
  coreDir = ownCore(),
): WebManifest {
  const dest = path.join(publicDir, 'codepad');
  for (const file of ['codepad.js', 'codepad.wasm']) {
    if (!existsSync(path.join(coreDir, file))) {
      throw new WebAssetsError(
        `${coreDir} has no ${file}. The package was built without its web core.`,
      );
    }
  }
  mkdirSync(dest, { recursive: true });
  copyFileSync(path.join(coreDir, 'codepad.js'), path.join(dest, 'codepad.js'));
  copyFileSync(path.join(coreDir, 'codepad.wasm'), path.join(dest, 'codepad.wasm'));
  const languages: WebLanguage[] = [];
  for (const { name, dir } of languagePackages(appRoot)) {
    const queries = path.join(dir, 'queries');
    const grammars = existsSync(queries)
      ? readdirSync(queries)
          .filter((g) => existsSync(path.join(queries, g, 'highlights.scm')))
          .sort()
      : [];
    for (const grammar of grammars) {
      const wasm = path.join(dir, 'web', `${grammar}.wasm`);
      if (!existsSync(wasm)) {
        throw new WebAssetsError(
          `${name} has no web/${grammar}.wasm. It was published without its web build.`,
        );
      }
      copyFileSync(wasm, path.join(dest, `${grammar}.wasm`));
      const copyQuery = (kind: string): string | null => {
        const from = path.join(queries, grammar, `${kind}.scm`);
        if (!existsSync(from)) return null;
        copyFileSync(from, path.join(dest, `${grammar}.${kind}.scm`));
        return `${grammar}.${kind}.scm`;
      };
      languages.push({
        id: grammar,
        wasm: `${grammar}.wasm`,
        symbol: `tree_sitter_${grammar}`,
        highlights: copyQuery('highlights'),
        injections: copyQuery('injections'),
      });
    }
  }
  const manifest: WebManifest = {
    version: 1,
    core: { js: 'codepad.js', wasm: 'codepad.wasm' },
    languages,
  };
  writeFileSync(path.join(dest, 'languages.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
