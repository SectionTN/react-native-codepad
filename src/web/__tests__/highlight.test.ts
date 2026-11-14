import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import {
  builtCore,
  cstring,
  highlight,
  loadCore,
  loadGrammar,
  pumpAll,
  ROOT,
  styleName,
  utf16,
  webGrammars,
} from '../../../tests/web/core';
import { INJECTION_ALIASES } from '../aliases';

const goldens = join(ROOT, 'tests/highlight');
const dir = builtCore('build/web-test', 'cpp/web/build.sh --test');
const grammars = webGrammars();
const names = readdirSync(goldens)
  .filter((f) => f.endsWith('.txt'))
  .map((f) => f.slice(0, -4))
  .sort();
const missing = names
  .map((n) => n.split('.')[0] as string)
  .filter((g) => !grammars.some((w) => w.grammar === g));
if (dir && missing.length > 0)
  console.warn(`grammars not built (${missing.join(', ')}), run yarn build:web-grammars`);

(dir && missing.length === 0 ? test : test.skip)(
  'every highlight golden matches in wasm',
  async () => {
    const m = await loadCore(dir as string);
    for (const g of grammars) loadGrammar(m, g.wasm, g.grammar, g.queries);
    for (const [name, id] of Object.entries(INJECTION_ALIASES)) {
      cstring(m, name, (n) => cstring(m, id, (i) => m._cpw_language_alias(n, i)));
    }
    for (const name of names) {
      const text = readFileSync(join(goldens, `${name}.txt`), 'utf8');
      const e = utf16(m, text, (p, n) => m._cpw_open(p, n, 8000n));
      cstring(m, name.split('.')[0] as string, (id) => m._cpw_set_language(e, id));
      pumpAll(m);
      const snapshot = m._cpw_snapshot(e);
      expect(m._cp_snapshot_length(snapshot)).toBe(text.length);
      const lines = text.split('\n');
      let actual = '';
      highlight(m, snapshot, 0, lines.length - 1, 0).forEach((runs, line) => {
        for (let i = 0; i < runs.length; i += 3) {
          actual += `${line} ${runs[i]} ${runs[i + 1]} ${styleName(m, runs[i + 2] as number)}\n`;
        }
      });
      m._cpw_close(e);
      expect({ name, spans: actual }).toEqual({
        name,
        spans: readFileSync(join(goldens, `${name}.spans`), 'utf8'),
      });
    }
    pumpAll(m);
  },
);
