import { expect, test } from '@jest/globals';
import { generateJavaScript } from '../../../example/src/bench/generate';
import { builtCore, loadCore } from '../../../tests/web/core';
import { EditorCore, SearchError } from '../core/EditorCore';
import { firstEndingAfter, mapThrough, SearchController } from '../search';

const dir = builtCore('lib/web', 'yarn build:web');
const run = dir ? test : test.skip;

// Runs the controller's scan to the end in steps of budgetMs.
function finish(c: SearchController, budgetMs = 1): number {
  let steps = 0;
  while (c.step(budgetMs)) steps++;
  return steps;
}

test('mapThrough keeps pairs before a change, shifts pairs after it and drops pairs it touches', () => {
  const pairs = [0, 2, 5, 7, 10, 12, 4, 6];
  // Three units inserted at 6: [5, 7) is cut, [4, 6) ends where it starts and stays.
  expect(mapThrough(pairs, { start: 6, end: 6, delta: 3 })).toEqual([0, 2, 13, 15, 4, 6]);
  // Units 3 to 5 removed: [5, 7) starts at its end and moves back.
  expect(mapThrough([0, 2, 5, 7], { start: 3, end: 5, delta: -2 })).toEqual([0, 2, 3, 5]);
});

test('firstEndingAfter finds the first match ending past an offset', () => {
  expect(firstEndingAfter([0, 2, 5, 7, 10, 12], 6)).toBe(1);
  expect(firstEndingAfter([0, 2, 5, 7, 10, 12], 12)).toBe(3);
  expect(firstEndingAfter([], 0)).toBe(0);
});

run('a scan sliced at 1 ms over js10k finds the same pairs as cp_editor_matches', async () => {
  const m = await loadCore(dir as string);
  const core = new EditorCore(m, generateJavaScript(10_000));
  const c = new SearchController(core, () => {});
  c.setQuery({ text: 'cache' });
  expect(core.searchStale).toBe(true);
  finish(c);
  expect(core.searchStale).toBe(false);
  const sliced = c.matchesForPaint();
  expect(sliced.length).toBeGreaterThan(1000);
  expect(sliced).toEqual(core.matches);
  expect(core.matchCount).toBe(sliced.length / 2);
  c.close();
  core.close();
});

run('an edit during a scan drops it and the accepted result is for the new revision', async () => {
  const m = await loadCore(dir as string);
  const core = new EditorCore(m, generateJavaScript(100_000));
  const c = new SearchController(core, () => {});
  c.setQuery({ text: 'value' });
  expect(c.step(1)).toBe(true);
  expect(core.searchStale).toBe(true);
  core.replace(0, 0, 'value ');
  for (const change of core.takeChanges()) c.onChange(change);
  finish(c);
  expect(core.searchStale).toBe(false);
  expect(c.matchesForPaint().slice(0, 2)).toEqual([0, 5]);
  expect(c.matchesForPaint()).toEqual(core.matches);
  c.close();
  core.close();
});

run('whenFresh runs at once when nothing is stale and after the accept otherwise', async () => {
  const m = await loadCore(dir as string);
  const core = new EditorCore(m, 'ab ab ab');
  let fresh = 0;
  const c = new SearchController(core, () => {});
  c.whenFresh(() => fresh++);
  expect(fresh).toBe(1);
  c.setQuery({ text: 'ab' });
  c.whenFresh(() => fresh++);
  expect(fresh).toBe(1);
  finish(c);
  expect(fresh).toBe(2);
  expect(core.matchCount).toBe(3);
  c.close();
  core.close();
});

run('an invalid regex throws SearchError and leaves no matches', async () => {
  const m = await loadCore(dir as string);
  const core = new EditorCore(m, 'ab ab');
  const c = new SearchController(core, () => {});
  c.setQuery({ text: 'ab' });
  finish(c);
  expect(c.matchesForPaint()).toHaveLength(4);
  expect(() => c.setQuery({ text: '(', regex: true })).toThrow(SearchError);
  expect(c.matchesForPaint()).toEqual([]);
  expect(core.searchActive).toBe(false);
  expect(c.step(1)).toBe(false);
  c.close();
  core.close();
});

run('two controllers on two editors keep their own results', async () => {
  const m = await loadCore(dir as string);
  const a = new EditorCore(m, 'one two one');
  const b = new EditorCore(m, 'two two two two');
  const ca = new SearchController(a, () => {});
  const cb = new SearchController(b, () => {});
  ca.setQuery({ text: 'one' });
  cb.setQuery({ text: 'two' });
  while (ca.step(1) || cb.step(1));
  expect(a.matchCount).toBe(2);
  expect(b.matchCount).toBe(4);
  expect(ca.matchesForPaint()).toEqual([0, 3, 8, 11]);
  ca.close();
  cb.close();
  a.close();
  b.close();
});
