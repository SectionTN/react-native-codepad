import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TranslateError, luaPatternToRegex, vimRegexToRegex } from './predicates.ts';

test('lua patterns translate the nvim subset', () => {
  assert.equal(luaPatternToRegex('^[A-Z]'), '^[A-Z]');
  assert.equal(luaPatternToRegex('^_*[A-Z][A-Z%d_]*$'), '^_*[A-Z][A-Z0-9_]*$');
  assert.equal(luaPatternToRegex('^/[*][*][^*].*[*]/$'), '^/[*][*][^*].*[*]/$');
  assert.equal(luaPatternToRegex('%s+'), '\\s+');
  assert.equal(luaPatternToRegex('%a%w*'), '[A-Za-z][A-Za-z0-9]*');
  assert.equal(luaPatternToRegex('a%.b'), 'a\\.b');
  assert.equal(luaPatternToRegex('x-y'), 'x*?y');
  assert.equal(luaPatternToRegex('^`#graphql'), '^`#graphql');
});

test('lua patterns outside the subset throw', () => {
  assert.throws(() => luaPatternToRegex('(%d+)'), TranslateError);
  assert.throws(() => luaPatternToRegex('%b()'), TranslateError);
  assert.throws(() => luaPatternToRegex('%1'), TranslateError);
  assert.throws(() => luaPatternToRegex('%f[%w]'), TranslateError);
});

test('vim regexes translate magic and very magic forms', () => {
  assert.equal(vimRegexToRegex('^[A-Z]'), '^[A-Z]');
  assert.equal(vimRegexToRegex('\\<foo\\>'), '\\bfoo\\b');
  assert.equal(vimRegexToRegex('a\\|b'), 'a|b');
  assert.equal(vimRegexToRegex('a(b)'), 'a\\(b\\)');
  assert.equal(vimRegexToRegex('\\v^(a|b)+$'), '^(a|b)+$');
  assert.equal(vimRegexToRegex('\\v<[A-Z]\\w*>'), '\\b[A-Z]\\w*\\b');
  assert.equal(vimRegexToRegex('x\\{2,3}'), 'x{2,3}');
  assert.equal(vimRegexToRegex('a^b$c'), 'a\\^b\\$c');
});

test('vim regexes outside the subset throw', () => {
  assert.throws(() => vimRegexToRegex('\\zsfoo'), TranslateError);
  assert.throws(() => vimRegexToRegex('\\%[abc]'), TranslateError);
  assert.throws(() => vimRegexToRegex('\\V.'), TranslateError);
});

test('every translation compiles as a JavaScript RegExp', () => {
  for (const p of ['^[A-Z]', '^_*[A-Z][A-Z%d_]*$', '%s+', '%a%w*']) new RegExp(luaPatternToRegex(p));
  for (const v of ['\\<foo\\>', '\\v^(a|b)+$', 'x\\{2,3}']) new RegExp(vimRegexToRegex(v));
});
