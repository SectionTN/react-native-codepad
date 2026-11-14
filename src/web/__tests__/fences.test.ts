import { existsSync } from 'node:fs';
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
} from '../../../tests/web/core';
import { EditorCore } from '../core/EditorCore';

const dir = builtCore('lib/web', 'yarn build:web');
const grammar = (pkg: string, id: string) => ({
  wasm: join(ROOT, `languages/${pkg}/web/${id}.wasm`),
  queries: join(ROOT, `languages/${pkg}/queries/${id}`),
});
const markdown = grammar('markdown', 'markdown');
const inline = grammar('markdown', 'markdown_inline');
const python = grammar('python', 'python');
const ready = dir !== null && [markdown, inline, python].every((g) => existsSync(g.wasm));
if (dir && !ready)
  console.warn('markdown or python grammar not built, run yarn build:web-grammars');

const FENCE = '```python\ndef f(): pass\n```\n';

(ready ? test : test.skip)('a fence colors once its language loads', async () => {
  const m = await loadCore(dir as string);
  loadGrammar(m, markdown.wasm, 'markdown', markdown.queries);
  loadGrammar(m, inline.wasm, 'markdown_inline', inline.queries);
  const core = new EditorCore(m, FENCE);
  const keyword = cstring(m, 'keyword.function', (name) => m._cp_style_id(name));
  const fenceBody = () => {
    const line = highlight(m, core.snapshot, 1, 1, core.lineStart(1))[0] as number[];
    const triples = [];
    for (let i = 0; i + 2 < line.length; i += 3) triples.push(line.slice(i, i + 3));
    return triples;
  };
  expect(core.setLanguage('markdown')).toBe(true);
  pumpAll(m);
  expect(core.takeMissedLanguages()).toEqual(['python']);
  expect(fenceBody()).not.toContainEqual([0, 3, keyword]);

  loadGrammar(m, python.wasm, 'python', python.queries);
  core.refreshInjections();
  pumpAll(m);
  expect(fenceBody()).toContainEqual([0, 3, keyword]);
  expect(core.takeMissedLanguages()).toEqual([]);
  core.close();
  pumpAll(m);
});

// The loader refreshes only after a new language registers, since a refresh looks the names up again.
(ready ? test : test.skip)(
  'a refresh while the language is still missing reports it again',
  async () => {
    const m = await loadCore(dir as string);
    loadGrammar(m, markdown.wasm, 'markdown', markdown.queries);
    loadGrammar(m, inline.wasm, 'markdown_inline', inline.queries);
    const core = new EditorCore(m, FENCE);
    core.setLanguage('markdown');
    pumpAll(m);
    expect(core.takeMissedLanguages()).toEqual(['python']);
    const before = core.snapshotCount;
    core.refreshInjections();
    pumpAll(m);
    expect(core.takeMissedLanguages()).toEqual(['python']);
    expect(core.takeMissedLanguages()).toEqual([]);
    expect(core.snapshotCount).toBe(before + 1);
    core.close();
    pumpAll(m);
  },
);
