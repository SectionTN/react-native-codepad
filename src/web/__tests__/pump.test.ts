import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { generateJavaScript } from '../../../example/src/bench/generate';
import { builtCore, loadCore, loadGrammar, pumpAll, ROOT } from '../../../tests/web/core';
import { EditorCore } from '../core/EditorCore';
import type { CoreModule } from '../core/module';
import { registerTask, setPumpCore } from '../pump';

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

describe('engine tasks', () => {
  // A clock only the engine and the tasks move, so a paused test worker cannot change a turn.
  let clock = 0;
  // Each engine turn as the list of tasks it stepped, with the engine taking engineMs of the turn.
  let engineMs = 0;
  let turns: string[][] = [];
  // Resolves at the start of the turn after the ones counted, since engine turns can starve a timer.
  let counted: { count: number; done: () => void } | null = null;
  beforeAll(() => {
    jest.spyOn(performance, 'now').mockImplementation(() => clock);
    // The pump falls back to timers, since an open MessagePort keeps jest from exiting.
    (globalThis as { MessageChannel?: unknown }).MessageChannel = undefined;
    setPumpCore({
      _cpw_pump: () => {
        if (counted && turns.length === counted.count) counted.done();
        turns.push([]);
        clock += engineMs;
        return 0;
      },
    } as unknown as CoreModule);
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });

  // A task takes cost ms of the clock. once runs on its first step and can register a task again.
  type Spec = { name: string; cost?: number; once?: (again: (name: string) => void) => void };

  async function runTasks(specs: Spec[], count: number): Promise<string[][]> {
    turns = [];
    const reached = new Promise<void>((done) => {
      counted = { count, done };
    });
    const removals = new Map<string, () => void>();
    // One object per task registered again as itself, as a search controller does.
    const objects = new Map<string, { step(): boolean }>();
    for (const spec of specs) {
      let once = spec.once;
      const step = () => {
        turns.at(-1)?.push(spec.name);
        clock += spec.cost ?? 0;
        const run = once;
        once = undefined;
        run?.((name) => {
          removals.get(name)?.();
          const again = objects.get(name);
          if (again) removals.set(name, registerTask(again));
        });
        return true;
      };
      objects.set(spec.name, { step });
    }
    for (const [name, task] of objects) removals.set(name, registerTask(task));
    await reached;
    counted = null;
    for (const remove of removals.values()) remove();
    return turns.slice(0, count);
  }

  const named = (...names: string[]) => names.map((name) => ({ name }));

  test('a turn whose engine used the whole budget steps one task, the next in line each turn', async () => {
    engineMs = 8;
    expect(await runTasks(named('a', 'b', 'c'), 4)).toEqual([['a'], ['b'], ['c'], ['a']]);
  });

  test('a turn the engine left time in steps every task', async () => {
    engineMs = 0;
    expect(await runTasks(named('a', 'b', 'c'), 2)).toEqual([
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
    ]);
  });

  test('a task after the first waits for the next turn when less than 1 ms is left', async () => {
    engineMs = 0;
    const specs = [{ name: 'a', cost: 5.5 }, ...named('b', 'c')];
    expect(await runTasks(specs, 2)).toEqual([['a'], ['b', 'c', 'a']]);
  });

  test('a task registered again during a turn waits for the next turn, not its old place', async () => {
    engineMs = 0;
    const specs = [
      { name: 'a', once: (again: (name: string) => void) => again('b') },
      ...named('b', 'c'),
    ];
    expect(await runTasks(specs, 2)).toEqual([
      ['a', 'c'],
      ['a', 'b', 'c'],
    ]);
  });
});
