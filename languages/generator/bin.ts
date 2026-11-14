#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CustomLanguageError, emitCustomLanguage } from './custom.ts';
import { copyWebAssets, WebAssetsError } from './web-assets.ts';

const USAGE = [
  'usage: react-native-codepad language <grammar-dir> [--id <id>] [--out <dir>] [--name <npm name>] [--no-web]',
  '       react-native-codepad web <public-dir> [--root <app-root>]',
].join('\n');

function usage(): number {
  process.stderr.write(`${USAGE}\n`);
  return 2;
}

/** Runs the command line and returns the exit code. */
export function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === 'language') return language(rest);
  if (command === 'web') return web(rest);
  return usage();
}

function language(args: string[]): number {
  let parsed: ReturnType<typeof parseLanguageArgs>;
  try {
    parsed = parseLanguageArgs(args);
  } catch {
    return usage();
  }
  const [grammarDir, ...extra] = parsed.positionals;
  if (!grammarDir || extra.length > 0) return usage();
  try {
    const { id, npmName, outDir } = emitCustomLanguage({
      grammarDir,
      outDir: parsed.values.out,
      id: parsed.values.id,
      name: parsed.values.name,
      web: !parsed.values['no-web'],
    });
    process.stdout.write(
      `Wrote ${npmName} to ${outDir}.\nRebuild the app (run pod install first on iOS) and pass language="${id}" to CodeEditor.\n`,
    );
    return 0;
  } catch (e) {
    if (!(e instanceof CustomLanguageError)) throw e;
    process.stderr.write(`error: ${e.message}\n`);
    return 1;
  }
}

function parseLanguageArgs(args: string[]) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      id: { type: 'string' },
      out: { type: 'string' },
      name: { type: 'string' },
      'no-web': { type: 'boolean' },
    },
  });
}

function web(args: string[]): number {
  let parsed: ReturnType<typeof parseWebArgs>;
  try {
    parsed = parseWebArgs(args);
  } catch {
    return usage();
  }
  const [publicDir, ...extra] = parsed.positionals;
  if (!publicDir || extra.length > 0) return usage();
  try {
    const out = path.resolve(publicDir);
    const { languages } = copyWebAssets(path.resolve(parsed.values.root ?? '.'), out);
    const ids = languages.map((l) => l.id).join(', ') || 'none';
    process.stdout.write(
      `Copied the web core and ${languages.length} languages (${ids}) to ${path.join(out, 'codepad')}.\n`,
    );
    return 0;
  } catch (e) {
    if (!(e instanceof WebAssetsError)) throw e;
    process.stderr.write(`error: ${e.message}\n`);
    return 1;
  }
}

function parseWebArgs(args: string[]) {
  return parseArgs({ args, allowPositionals: true, options: { root: { type: 'string' } } });
}

// npm links the bin through node_modules/.bin, so compare real paths.
const entry = process.argv[1];
if (entry && realpathSync(entry) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
