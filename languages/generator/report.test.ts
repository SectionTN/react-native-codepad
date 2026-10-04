import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzePatterns, formatReport } from './report.ts';
import { splitPatterns } from './scm.ts';

test('analyzePatterns keeps supported predicates and drops the rest with a reason', () => {
  const src = [
    '((identifier) @c (#lua-match? @c "^[A-Z]"))',
    '((identifier) @c (#lua-match? @c "%b()"))',
    '((identifier) @c (#is? @c "x"))',
    '((comment) @d (#set! priority 90) (#offset! @d 0 1 0 0))',
    '(identifier) @v',
  ].join('\n');
  const result = analyzePatterns(splitPatterns(src));
  assert.equal(result.kept.length, 3);
  assert.deepEqual(result.dropped.map((d) => d.reason), ['lua-match?: unsupported %b', 'unsupported predicate is?']);
  assert.deepEqual(result.counts, { 'lua-match?': 2, 'is?': 1, 'set!': 1, 'offset!': 1 });
});

test('formatReport prints one row per language and a total', () => {
  const text = formatReport([
    { id: 'a', patterns: 10, dropped: 1, counts: { 'eq?': 3 }, reasons: ['x'] },
    { id: 'b', patterns: 30, dropped: 0, counts: {}, reasons: [] },
  ]);
  assert.match(text, /\| a \| 10 \| 1 \| 10\.0% \|/);
  assert.match(text, /total: 40 patterns, 1 dropped \(2\.5%\)/);
});
