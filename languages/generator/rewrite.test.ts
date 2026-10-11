import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rewriteQuery } from './rewrite.ts';

test('rewriteQuery translates lua and vim predicates into match? with escaped regex strings', () => {
  const src = [
    '((identifier) @c (#lua-match? @c "^[A-Z%d_]+$"))',
    '((identifier) @t (#vim-match? @t "\\\\<[A-Z]"))',
    '((identifier) @u (#any-lua-match? @u "%s"))',
  ].join('\n');
  const { text, dropped } = rewriteQuery(src);
  assert.equal(dropped.length, 0);
  assert.equal(
    text,
    [
      '((identifier) @c (#match? @c "^[A-Z0-9_]+$"))',
      '((identifier) @t (#match? @t "\\\\b[A-Z]"))',
      '((identifier) @u (#any-match? @u "\\\\s"))',
    ].join('\n'),
  );
});

test('rewriteQuery refuses ancestor predicates in an injections query', () => {
  const src =
    '((code) @injection.content (#has-ancestor? @injection.content document) (#set! injection.language "x"))';
  assert.throws(
    () => rewriteQuery(src, { injections: true }),
    /has-ancestor\? is not allowed in injections\.scm/,
  );
  assert.throws(
    () => rewriteQuery(src.replace('has-ancestor?', 'not-has-parent?'), { injections: true }),
    /not-has-parent\?/,
  );
  assert.equal(rewriteQuery(src).dropped.length, 0);
});

test('rewriteQuery replaces dropped patterns with a comment and keeps the rest verbatim', () => {
  const src = '(a) @a\n((b) @b (#is? @b "x"))\n((c) @c (#set! priority 90))';
  const { text, dropped } = rewriteQuery(src);
  assert.equal(dropped.length, 1);
  assert.equal(text, '(a) @a\n; dropped: unsupported predicate is?\n((c) @c (#set! priority 90))');
});
