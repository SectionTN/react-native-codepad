import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CustomLanguageError, emitCustomLanguage, SHIPPED_IDS } from './custom.ts';
import { loadManifest, repoRoot } from './manifest.ts';

const FIXTURE = path.join(repoRoot, 'tests/fixtures/kv_lite');
const CORE = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  .version as string;

const temp = () => mkdtempSync(path.join(tmpdir(), 'codepad-custom-'));
const read = (dir: string, rel: string) => readFileSync(path.join(dir, rel), 'utf8');
const json = (dir: string, rel: string) => JSON.parse(read(dir, rel));

// A copy of the fixture a test may change.
function fixtureCopy(): string {
  const dir = path.join(temp(), 'kv_lite');
  cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walk(file, out);
    else out.push(file);
  }
  return out;
}

function rejects(fn: () => unknown, message: RegExp): void {
  assert.throws(fn, (e) => e instanceof CustomLanguageError && message.test(e.message));
}

test('emits a private package from the fixture', () => {
  const out = path.join(temp(), 'pkg');
  const r = emitCustomLanguage({ grammarDir: FIXTURE, outDir: out });
  assert.deepEqual(r, { id: 'kv_lite', npmName: 'codepad-lang-kv_lite', outDir: out });
  const pkg = json(out, 'package.json');
  assert.equal(pkg.name, 'codepad-lang-kv_lite');
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'UNLICENSED');
  assert.equal(pkg.version, '1.0.0');
  assert.deepEqual(pkg.peerDependencies, { 'react-native-codepad': `^${CORE}` });
  assert.deepEqual(pkg.codepad, { generated: true, core: CORE });
  assert.equal(pkg.repository, undefined);
  assert.equal(pkg.author, undefined);
  assert.match(
    read(out, 'android/src/main/cpp/lang.c'),
    /Java_me_sectiontn_codepad_lang_kv_1lite_KvLiteLanguage_nativeLanguage/,
  );
  assert.ok(existsSync(path.join(out, 'ios/CPLangKvLite.swift')));
  assert.ok(existsSync(path.join(out, 'CodepadLangKvLite.podspec')));
  assert.ok(existsSync(path.join(out, 'grammar/src/parser.c')));
  assert.ok(existsSync(path.join(out, 'grammar/src/tree_sitter/parser.h')));
  assert.equal(existsSync(path.join(out, 'grammar/src/node-types.json')), false);
  assert.match(read(out, 'queries/kv_lite/highlights.scm'), /\(key\) @property/);
  assert.equal(existsSync(path.join(out, 'queries/kv_lite/injections.scm')), false);
  assert.equal(existsSync(path.join(out, 'THIRD_PARTY_NOTICES.md')), false);
  assert.match(read(out, 'README.md'), /npx react-native-codepad language/);
  assert.match(read(out, 'README.md'), /language="kv_lite"/);
  for (const file of walk(out)) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /SectionTN|nvim/, file);
  }
});

test('--id and --name rename the package, not the C entry point', () => {
  const out = path.join(temp(), 'pkg');
  const r = emitCustomLanguage({ grammarDir: FIXTURE, outDir: out, id: 'kv', name: '@acme/kv' });
  assert.deepEqual(r, { id: 'kv', npmName: '@acme/kv', outDir: out });
  assert.equal(json(out, 'package.json').name, '@acme/kv');
  assert.match(read(out, 'ios/CPLangKv.swift'), /tree_sitter_kv_lite\(\)/);
  assert.match(read(out, 'ios/CPLangKv.swift'), /public let id: String = "kv"/);
  assert.ok(existsSync(path.join(out, 'queries/kv/highlights.scm')));
});

test('relative paths resolve against cwd, and the default out is cwd/modules', () => {
  const cwd = temp();
  cpSync(FIXTURE, path.join(cwd, 'grammars/kv_lite'), { recursive: true });
  const r = emitCustomLanguage({ grammarDir: 'grammars/kv_lite', cwd });
  assert.equal(r.outDir, path.join(cwd, 'modules/codepad-lang-kv_lite'));
  assert.ok(existsSync(path.join(r.outDir, 'package.json')));
  const other = emitCustomLanguage({ grammarDir: 'grammars/kv_lite', outDir: 'out/kv', cwd });
  assert.equal(other.outDir, path.join(cwd, 'out/kv'));
});

test('an npm author object becomes one author string', () => {
  const dir = fixtureCopy();
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      version: '2.0.0',
      author: { name: 'Ann', email: 'a@b.c', url: 'https://x' },
    }),
  );
  const out = path.join(temp(), 'pkg');
  emitCustomLanguage({ grammarDir: dir, outDir: out });
  assert.equal(json(out, 'package.json').author, 'Ann <a@b.c> (https://x)');
  assert.equal(json(out, 'package.json').version, '2.0.0');
});

test('rejects ids that cannot name a package', () => {
  const out = path.join(temp(), 'pkg');
  rejects(() => emitCustomLanguage({ grammarDir: FIXTURE, outDir: out, id: 'Kv' }), /"Kv"/);
  rejects(() => emitCustomLanguage({ grammarDir: FIXTURE, outDir: out, id: '1kv' }), /"1kv"/);
  rejects(
    () => emitCustomLanguage({ grammarDir: FIXTURE, outDir: out, id: 'kv-lite' }),
    /"kv-lite"/,
  );
  rejects(() => emitCustomLanguage({ grammarDir: FIXTURE, outDir: out, id: 'fun' }), /Kotlin/);
  rejects(() => emitCustomLanguage({ grammarDir: FIXTURE, outDir: out, id: 'int' }), /Java/);
  rejects(() => emitCustomLanguage({ grammarDir: FIXTURE, outDir: out, id: 'python' }), /ships/);
  rejects(
    () => emitCustomLanguage({ grammarDir: FIXTURE, outDir: out, id: 'markdown_inline' }),
    /ships/,
  );
  assert.equal(existsSync(out), false);
});

test('rejects a grammar folder it cannot build', () => {
  const out = () => path.join(temp(), 'pkg');
  const broken = (change: (dir: string) => void): string => {
    const dir = fixtureCopy();
    change(dir);
    return dir;
  };
  const parser = (dir: string) => path.join(dir, 'src/parser.c');
  rejects(
    () => emitCustomLanguage({ grammarDir: path.join(temp(), 'empty'), outDir: out() }),
    /src\/parser\.c/,
  );
  const noSymbol = broken((d) =>
    writeFileSync(parser(d), read(d, 'src/parser.c').replace(/tree_sitter_kv_lite/g, 'kv')),
  );
  rejects(() => emitCustomLanguage({ grammarDir: noSymbol, outDir: out() }), /tree_sitter_/);
  rejects(
    () => emitCustomLanguage({ grammarDir: withoutParserH(), outDir: out() }),
    /src\/tree_sitter\/parser\.h/,
  );
  const cxx = broken((d) => writeFileSync(path.join(d, 'src/scanner.cc'), ''));
  rejects(() => emitCustomLanguage({ grammarDir: cxx, outDir: out() }), /scanner\.cc/);
  const outside = broken((d) =>
    writeFileSync(path.join(d, 'src/scanner.c'), '#include"../common/scanner.h"\n'),
  );
  rejects(
    () => emitCustomLanguage({ grammarDir: outside, outDir: out() }),
    /\.\.\/common\/scanner\.h/,
  );
  const outsideHeader = broken((d) => {
    writeFileSync(path.join(d, 'src/scanner.c'), '#include "tag.h"\n');
    writeFileSync(path.join(d, 'src/tag.h'), '#include "../../common/tag.h"\n');
  });
  rejects(
    () => emitCustomLanguage({ grammarDir: outsideHeader, outDir: out() }),
    /src\/tag\.h includes "\.\.\/\.\.\/common\/tag\.h"/,
  );
  const oldAbi = broken((d) =>
    writeFileSync(
      parser(d),
      read(d, 'src/parser.c').replace(
        /#define LANGUAGE_VERSION \d+/,
        '#define LANGUAGE_VERSION 12',
      ),
    ),
  );
  rejects(() => emitCustomLanguage({ grammarDir: oldAbi, outDir: out() }), /ABI 12/);
  rejects(
    () => emitCustomLanguage({ grammarDir: withoutHighlights(), outDir: out() }),
    /queries\/highlights\.scm/,
  );
});

// The fixture without src/tree_sitter/parser.h.
function withoutParserH(): string {
  const dir = path.join(temp(), 'kv_lite');
  mkdirSync(dir, { recursive: true });
  cpSync(path.join(FIXTURE, 'queries'), path.join(dir, 'queries'), { recursive: true });
  mkdirSync(path.join(dir, 'src'));
  cpSync(path.join(FIXTURE, 'src/parser.c'), path.join(dir, 'src/parser.c'));
  return dir;
}

// The fixture without queries/highlights.scm.
function withoutHighlights(): string {
  const dir = path.join(temp(), 'kv_lite');
  mkdirSync(dir, { recursive: true });
  cpSync(path.join(FIXTURE, 'src'), path.join(dir, 'src'), { recursive: true });
  return dir;
}

test('stops on a pattern it would drop, and on inherits', () => {
  const dropped = fixtureCopy();
  writeFileSync(
    path.join(dropped, 'queries/highlights.scm'),
    '((key) @variable (#is-not? local))\n',
  );
  rejects(
    () => emitCustomLanguage({ grammarDir: dropped, outDir: path.join(temp(), 'pkg') }),
    /is-not\?/,
  );
  const inherits = fixtureCopy();
  writeFileSync(
    path.join(inherits, 'queries/highlights.scm'),
    '; inherits: ecma\n(key) @property\n',
  );
  rejects(
    () => emitCustomLanguage({ grammarDir: inherits, outDir: path.join(temp(), 'pkg') }),
    /inherits/,
  );
});

test('refuses an output folder it did not generate', () => {
  const out = temp();
  writeFileSync(path.join(out, 'package.json'), JSON.stringify({ name: 'my-app' }));
  rejects(() => emitCustomLanguage({ grammarDir: FIXTURE, outDir: out }), /not generated/);
  assert.equal(existsSync(path.join(out, 'android')), false);
});

test('regenerates its own output and removes stale files', () => {
  const out = path.join(temp(), 'pkg');
  emitCustomLanguage({ grammarDir: FIXTURE, outDir: out });
  const stale = path.join(out, 'queries/kv_lite/injections.scm');
  writeFileSync(stale, '');
  emitCustomLanguage({ grammarDir: FIXTURE, outDir: out });
  assert.equal(existsSync(stale), false);
  assert.ok(existsSync(path.join(out, 'queries/kv_lite/highlights.scm')));
});

test('SHIPPED_IDS matches grammars.json', () => {
  const ids = loadManifest().languages.flatMap((l) => [l.id, ...l.grammars.map((g) => g.name)]);
  assert.deepEqual([...SHIPPED_IDS].sort(), [...new Set(ids)].sort());
});

test('refuses a grammar whose C name is a grammar CodePad ships', () => {
  const dir = fixtureCopy();
  const parser = path.join(dir, 'src/parser.c');
  writeFileSync(
    parser,
    read(dir, 'src/parser.c').replace(/tree_sitter_kv_lite/g, 'tree_sitter_python'),
  );
  rejects(
    () =>
      emitCustomLanguage({ grammarDir: dir, outDir: path.join(temp(), 'pkg'), id: 'python_ext' }),
    /tree_sitter_python.*grammar\.js/s,
  );
});
