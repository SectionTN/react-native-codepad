import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wasmImporting } from './wasm-fixture.ts';
import { grammarImportsOutside } from './wasm-imports.ts';

test('finds an import outside the list', () => {
  assert.deepEqual(grammarImportsOutside(wasmImporting(['malloc', 'qsort']), ['malloc']), [
    'qsort',
  ]);
  assert.deepEqual(grammarImportsOutside(wasmImporting(['malloc']), ['malloc', 'free']), []);
});
