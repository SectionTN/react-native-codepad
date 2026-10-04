import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseInherits, resolveQuery } from './queries.ts';

test('parseInherits reads the modeline and strips optional parens', () => {
  assert.deepEqual(parseInherits('; inherits: ecma,(jsx)\n(x) @a'), {
    parents: ['ecma', 'jsx'],
    body: '(x) @a',
  });
  assert.deepEqual(parseInherits(';; extends\n(x) @a'), { parents: [], body: '(x) @a' });
  assert.deepEqual(parseInherits('(x) @a'), { parents: [], body: '(x) @a' });
});

test('resolveQuery concatenates parents first, depth first, without cycles', () => {
  const files: Record<string, string> = {
    'tsx/highlights': '; inherits: typescript,(jsx)\n(tsx) @t',
    'typescript/highlights': '; inherits: ecma\n(ts) @t',
    'ecma/highlights': '(ecma) @e',
    'jsx/highlights': '; inherits: ecma\n(jsx) @j',
  };
  const read = (lang: string, kind: string) => files[`${lang}/${kind}`] ?? null;
  const out = resolveQuery('tsx', 'highlights', read);
  assert.equal(
    out,
    [
      '; inherited from typescript',
      '; inherited from ecma',
      '(ecma) @e',
      '(ts) @t',
      '; inherited from jsx',
      '(jsx) @j',
      '(tsx) @t',
    ].join('\n'),
  );
});

test('resolveQuery returns null for a missing file and skips missing optional parents', () => {
  const read = (lang: string) => (lang === 'a' ? '; inherits: (missing)\n(a) @a' : null);
  assert.equal(resolveQuery('a', 'highlights', read), '(a) @a');
  assert.equal(resolveQuery('b', 'highlights', read), null);
});
