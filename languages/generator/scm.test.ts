import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitPatterns, tokenize } from './scm.ts';

test('tokenize handles comments, strings with escapes, captures and predicates', () => {
  const toks = tokenize('; comment\n((identifier) @x (#eq? @x "a\\"b"))');
  assert.deepEqual(
    toks.map((t) => [t.t, t.v]),
    [
      ['open', '('],
      ['open', '('],
      ['word', 'identifier'],
      ['close', ')'],
      ['cap', '@x'],
      ['open', '('],
      ['pred', '#eq?'],
      ['cap', '@x'],
      ['str', 'a"b'],
      ['close', ')'],
      ['close', ')'],
    ],
  );
});

test('splitPatterns separates top level patterns and keeps trailing captures', () => {
  const src =
    '(identifier) @variable\n["const" "let"] @keyword\n"=" @operator\n((string) @s (#set! priority 105))';
  const patterns = splitPatterns(src);
  assert.equal(patterns.length, 4);
  assert.equal(patterns[0]!.text, '(identifier) @variable');
  assert.deepEqual(patterns[1]!.captures, ['keyword']);
  assert.equal(patterns[2]!.text, '"=" @operator');
  assert.deepEqual(
    patterns[3]!.predicates.map((p) => p.name),
    ['set!'],
  );
  assert.deepEqual(patterns[3]!.predicates[0]!.args, [
    { kind: 'ident', value: 'priority' },
    { kind: 'ident', value: '105' },
  ]);
});

test('splitPatterns records capture and string arguments of predicates', () => {
  const [p] = splitPatterns(
    '((identifier) @c (#lua-match? @c "^[A-Z]") (#not-any-of? @c "A" "B"))',
  );
  assert.deepEqual(
    p!.predicates.map((x) => x.name),
    ['lua-match?', 'not-any-of?'],
  );
  assert.deepEqual(p!.predicates[1]!.args, [
    { kind: 'capture', value: 'c' },
    { kind: 'string', value: 'A' },
    { kind: 'string', value: 'B' },
  ]);
  assert.deepEqual(p!.captures, ['c']);
});

test('a top level predicate group attaches to the previous pattern', () => {
  const patterns = splitPatterns('(comment) @comment (#set! priority 90)');
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0]!.predicates[0]!.name, 'set!');
});
