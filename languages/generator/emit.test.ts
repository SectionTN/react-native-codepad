import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { cmake, type EmitContext, jniName, kotlinStringLiteral, swiftRawString } from './emit.ts';

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

test('kotlinStringLiteral escapes dollars and triple quotes and chunks long text', () => {
  assert.equal(kotlinStringLiteral('a$b'), '"""a${\'$\'}b"""');
  assert.equal(kotlinStringLiteral('x"""y'), '"""x""${\'"\'}y"""');
  const long = 'q'.repeat(70_000);
  assert.match(
    kotlinStringLiteral(long),
    /^listOf\(\n\s+"""q+""",\n\s+"""q+""",\n\)\.joinToString\(""\)$/,
  );
});

test('swiftRawString wraps in a raw multiline literal', () => {
  assert.equal(swiftRawString('a\\b"c'), '#"""\na\\b"c\n"""#');
});

test('cmake puts each grammar source dir on the include path', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'codepad-cmake-'));
  mkdirSync(path.join(dir, 'typescript/src'), { recursive: true });
  writeFileSync(path.join(dir, 'typescript/src/scanner.c'), '');
  const entry = {
    id: 'typescript',
    repo: 'r',
    rev: 'v',
    grammars: [{ name: 'typescript', src: 'typescript/src' }],
  };
  const text = cmake({ entry, grammarDir: dir } as EmitContext);
  assert.match(
    text,
    /target_include_directories\(codepad_lang_typescript PRIVATE \$\{GRAMMAR\}\/typescript\/src\)/,
  );
  assert.match(text, /\$\{GRAMMAR\}\/typescript\/src\/scanner\.c/);
});
