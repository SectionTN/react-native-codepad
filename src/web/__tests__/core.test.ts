import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import {
  builtCore,
  cstring,
  loadCore,
  loadGrammar,
  pumpAll,
  ROOT,
  utf16,
} from '../../../tests/web/core';
import { EditorCore } from '../core/EditorCore';

const dir = builtCore('lib/web', 'yarn build:web');
const python = join(ROOT, 'languages/python/web/python.wasm');
const ready = dir !== null && existsSync(python);
if (dir && !ready) console.warn('python grammar not built, run yarn build:web-grammars');

(ready ? test : test.skip)('the core parses python and highlights in wasm', async () => {
  const m = await loadCore(dir as string);
  loadGrammar(m, python, 'python', join(ROOT, 'languages/python/queries/python'));
  const e = utf16(m, 'def greet(name):\n    return name\n', (p, n) => m._cpw_open(p, n, 8000n));
  expect(cstring(m, 'python', (id) => m._cpw_set_language(e, id))).toBe(1);
  pumpAll(m);
  const snapshot = m._cpw_snapshot(e);
  expect(snapshot).not.toBe(0);
  const out = m._malloc(4 * 256);
  const count = m._cp_highlight(snapshot, 0, 0, 0, out, 256);
  const ints = Array.from(m.HEAP32.subarray(out >> 2, (out >> 2) + count));
  m._free(out);
  const keyword = cstring(m, 'keyword.function', (name) => m._cp_style_id(name));
  const triples = [];
  for (let i = 1; i + 2 < ints.length; i += 3) triples.push(ints.slice(i, i + 3));
  expect(triples).toContainEqual([0, 3, keyword]);
  m._cpw_close(e);
});

(dir ? test : test.skip)('reads a leading U+FEFF and half a surrogate pair as stored', async () => {
  const m = await loadCore(dir as string);
  const core = new EditorCore(m, '﻿x\u{1F600}');
  expect(core.text()).toBe('﻿x\u{1F600}');
  expect(core.text(2, 3)).toBe('\uD83D');
  core.close();
});
