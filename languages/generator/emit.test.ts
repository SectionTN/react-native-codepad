import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  cmake,
  type EmitContext,
  type EmitEntry,
  emitPackage,
  jniName,
  kotlinStringLiteral,
  type PackageIdentity,
  shippedIdentity,
  swiftRawString,
} from './emit.ts';

test('jniName escapes underscores in package segments', () => {
  assert.equal(
    jniName(
      'me.sectiontn.codepad.lang.markdown_inline',
      'MarkdownInlineLanguage',
      'nativeLanguage',
    ),
    'Java_me_sectiontn_codepad_lang_markdown_1inline_MarkdownInlineLanguage_nativeLanguage',
  );
});

test('the string literal emitters escape their delimiters and chunk long text', () => {
  assert.equal(kotlinStringLiteral('a$b'), '"""a${\'$\'}b"""');
  assert.equal(kotlinStringLiteral('x"""y'), '"""x""${\'"\'}y"""');
  const long = 'q'.repeat(70_000);
  assert.match(
    kotlinStringLiteral(long),
    /^listOf\(\n\s+"""q+""",\n\s+"""q+""",\n\)\.joinToString\(""\)$/,
  );
  assert.equal(swiftRawString('a\\b"c'), '#"""\na\\b"c\n"""#');
  assert.equal(swiftRawString('x"""#y'), '##"""\nx"""#y\n"""##');
  assert.equal(swiftRawString('"^\\#(a)"'), '##"""\n"^\\#(a)"\n"""##');
});

test('cmake puts each grammar source dir on the include path', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'codepad-cmake-'));
  mkdirSync(path.join(dir, 'typescript/src'), { recursive: true });
  writeFileSync(path.join(dir, 'typescript/src/scanner.c'), '');
  const entry = {
    id: 'typescript',
    grammars: [{ name: 'typescript', src: 'typescript/src' }],
  };
  const text = cmake({ entry, grammarDir: dir } as EmitContext);
  assert.match(
    text,
    /target_include_directories\(codepad_lang_typescript PRIVATE \$\{GRAMMAR\}\/typescript\/src\)/,
  );
  assert.match(text, /\$\{GRAMMAR\}\/typescript\/src\/scanner\.c/);
});

const IDENTITY: PackageIdentity = {
  packageJson: { name: 'x' },
  readme: 'r',
  notices: null,
  podSource: '{ :git => "" }',
  podFallbacks: true,
};

// Emits into a temp folder from a grammar folder holding an empty src/parser.c; returns the out dir.
function emitInto(entry: EmitEntry, identity: PackageIdentity = IDENTITY): string {
  const root = mkdtempSync(path.join(tmpdir(), 'codepad-emit-'));
  const grammarDir = path.join(root, 'grammar');
  mkdirSync(path.join(grammarDir, 'src'), { recursive: true });
  writeFileSync(path.join(grammarDir, 'src/parser.c'), '');
  const outDir = path.join(root, 'out');
  const queries = Object.fromEntries(
    entry.grammars.map((g) => [
      g.name,
      { highlights: '(x) @y', injections: null, locals: null, indents: null },
    ]),
  );
  emitPackage({ entry, version: '1.2.3', outDir, grammarDir, queries, identity });
  return outDir;
}

const read = (dir: string, rel: string) => readFileSync(path.join(dir, rel), 'utf8');

test('the Kotlin provider loads the library CMake builds', () => {
  const out = emitInto({ id: 'kv_lite', grammars: [{ name: 'kv_lite', src: 'src' }] });
  assert.match(read(out, 'android/CMakeLists.txt'), /add_library\(codepad_lang_kv_lite SHARED/);
  assert.match(
    read(out, 'android/src/main/java/me/sectiontn/codepad/lang/kv_lite/KvLiteLanguage.kt'),
    /System\.loadLibrary\("codepad_lang_kv_lite"\)/,
  );
});

test('a grammar symbol overrides the C entry point only', () => {
  const out = emitInto({ id: 'kv', grammars: [{ name: 'kv', src: 'src', symbol: 'kv_lite' }] });
  assert.match(
    read(out, 'android/src/main/cpp/lang.c'),
    /return \(jlong\) \(intptr_t\) tree_sitter_kv_lite\(\);/,
  );
  assert.match(read(out, 'ios/CPLangKv.h'), /const void \*tree_sitter_kv_lite\(void\);/);
  assert.match(read(out, 'ios/CPLangKv.swift'), /tree_sitter_kv_lite\(\)/);
  assert.match(read(out, 'ios/CPLangKv.swift'), /public let id: String = "kv"/);
});

test('the identity decides package.json, notices and the pod source', () => {
  const out = emitInto({ id: 'kv_lite', grammars: [{ name: 'kv_lite', src: 'src' }] });
  assert.deepEqual(JSON.parse(read(out, 'package.json')), { name: 'x' });
  assert.equal(read(out, 'README.md'), 'r\n');
  assert.equal(existsSync(path.join(out, 'THIRD_PARTY_NOTICES.md')), false);
  const podspec = read(out, 'CodepadLangKvLite.podspec');
  assert.match(podspec, /s\.source\s+= \{ :git => "" \}/);
  assert.match(podspec, /s\.authors\s+= package\["author"\] \|\| "unknown"/);
  assert.match(podspec, /s\.homepage\s+= package\["homepage"\] \|\| "https:\/\/reactnativecodepad/);
});

test('the shipped README links the docs site', () => {
  const entry = {
    id: 'kv_lite',
    repo: 'r',
    rev: 'v',
    grammars: [{ name: 'kv_lite', src: 'src' }],
  };
  const { readme } = shippedIdentity({
    entry,
    version: '1.2.3',
    queries: { kv_lite: { highlights: '(x) @y', injections: null, locals: null, indents: null } },
    grammarLicense: null,
    nvimRev: 'n',
  });
  assert.match(readme, /https:\/\/reactnativecodepad\.pages\.dev\/guides\/languages\//);
  assert.doesNotMatch(readme, /sectiontn\.github\.io/);
});
