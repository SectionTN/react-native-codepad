import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jniName, kotlinStringLiteral, swiftRawString } from './emit.ts';

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
