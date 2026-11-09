import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { main } from './bin.ts';
import { repoRoot } from './manifest.ts';

const FIXTURE = path.join(repoRoot, 'tests/fixtures/kv_lite');
const out = () => path.join(mkdtempSync(path.join(tmpdir(), 'codepad-bin-')), 'pkg');

test('language writes the package and returns 0', () => {
  const dir = out();
  assert.equal(main(['language', FIXTURE, '--out', dir]), 0);
  assert.ok(existsSync(path.join(dir, 'package.json')));
});

test('a refused grammar or id returns 1', () => {
  assert.equal(main(['language', FIXTURE, '--id', 'python', '--out', out()]), 1);
});

test('usage errors return 2', () => {
  assert.equal(main([]), 2);
  assert.equal(main(['build', FIXTURE]), 2);
  assert.equal(main(['language']), 2);
  assert.equal(main(['language', FIXTURE, '--bogus']), 2);
});
