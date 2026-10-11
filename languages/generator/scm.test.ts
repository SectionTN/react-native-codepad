import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitPatterns } from './scm.ts';

test('splitPatterns separates top level patterns and keeps trailing captures', () => {
  // The comment line carries parens and a capture that must not become tokens; the string argument has an escape.
  const src =
    '; comment (with parens) @fake\n(identifier) @variable\n["const" "let"] @keyword\n"=" @operator\n((string) @s (#set! priority 105) (#eq? @s "a\\"b"))';
  const patterns = splitPatterns(src);
  assert.equal(patterns.length, 4);
  assert.equal(patterns[0]!.text, '(identifier) @variable');
  assert.deepEqual(patterns[1]!.captures, ['keyword']);
  assert.equal(patterns[2]!.text, '"=" @operator');
  assert.deepEqual(
    patterns[3]!.predicates.map((p) => p.name),
    ['set!', 'eq?'],
  );
  assert.deepEqual(patterns[3]!.predicates[0]!.args, [
    { kind: 'ident', value: 'priority' },
    { kind: 'ident', value: '105' },
  ]);
  assert.deepEqual(patterns[3]!.predicates[1]!.args, [
    { kind: 'capture', value: 's' },
    { kind: 'string', value: 'a"b' },
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
