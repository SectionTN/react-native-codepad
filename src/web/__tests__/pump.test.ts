import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { generateJavaScript } from '../../../example/src/bench/generate';
import { builtCore, loadCore, loadGrammar, pumpAll, ROOT } from '../../../tests/web/core';
import { EditorCore } from '../core/EditorCore';

const dir = builtCore('lib/web', 'yarn build:web');
const javascript = join(ROOT, 'languages/javascript/web/javascript.wasm');
const ready = dir !== null && existsSync(javascript);
if (dir && !ready) console.warn('javascript grammar not built, run yarn build:web-grammars');

// The jest preset rounds performance.now to whole milliseconds.
const now = () => Number(process.hrtime.bigint()) / 1e6;

(ready ? test : test.skip)('one pump starts no second parse slice', async () => {
  const m = await loadCore(dir as string);
  loadGrammar(m, javascript, 'javascript', join(ROOT, 'languages/javascript/queries/javascript'));
  // 2 ms slices with the pump told 4: the old rule starts three in 6 ms, the new one only the first.
  const core = new EditorCore(m, generateJavaScript(100_000), 2000);
  expect(core.setLanguage('javascript')).toBe(true);
  const took: number[] = [];
  for (let i = 0; i < 30; i++) {
    const start = now();
    const left = m._cpw_pump(6, 4);
    took.push(now() - start);
    if (left === 0) break;
  }
  expect(took.length).toBe(30);
  took.sort((a, b) => a - b);
  expect(took[15]).toBeLessThan(4);
  core.close();
  pumpAll(m);
});
