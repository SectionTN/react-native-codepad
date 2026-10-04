import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureNames } from './captures.ts';

test('captureNames lists unique public captures sorted', () => {
  const names = captureNames('(a) @keyword\n((b) @_hidden @string.special)\n(c) @keyword');
  assert.deepEqual(names, ['keyword', 'string.special']);
});
