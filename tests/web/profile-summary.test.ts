import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error plain JavaScript script without types
import { summarize } from '../../scripts/profile-summary.mjs';

type Node = { id: number; callFrame: { functionName: string }; children?: number[] };

// A CDP profile: nodes by id with children, one sample per node id, timeDeltas in microseconds.
function profile(nodes: Node[], samples: number[], intervalUs: number) {
  return {
    nodes,
    startTime: 0,
    endTime: samples.length * intervalUs,
    samples,
    timeDeltas: samples.map(() => intervalUs),
  };
}

const node = (id: number, functionName: string, children: number[] = []): Node => ({
  id,
  callFrame: { functionName },
  children,
});

const ROOTS = { drawKeyed: 'key draw', runEngine: 'engine', applyInput: 'handler' };

test('samples go to the nearest root on their stack, snapshot frames to other', () => {
  const nodes = [
    node(1, '(root)', [2, 7]),
    node(2, 'frame', [3, 10]),
    node(3, 'drawKeyed', [4]),
    node(4, 'draw', [5]),
    node(5, 'frame', [6]),
    node(6, 'paint'),
    node(7, 'runEngine', [8]),
    node(8, 'wasm-function[cp_reparse]'),
    node(10, 'draw', [11]),
    node(11, 'frame', [12]),
    node(12, 'paint'),
  ];
  const samples = [6, 6, 6, 12, 12, 12, 12, 8, 8];
  const out = summarize(profile(nodes, samples, 100), ROOTS, 12);
  assert.deepEqual(out['key draw'], [{ fn: 'paint', selfMs: 0.3 }]);
  assert.deepEqual(out.engine, [{ fn: 'wasm-function[cp_reparse]', selfMs: 0.2 }]);
  assert.deepEqual(out.other, [{ fn: 'paint', selfMs: 0.4 }]);
});

test('each group lists at most top functions, largest self time first', () => {
  const nodes = [
    node(1, '(root)', [2]),
    node(2, 'runEngine', [3, 4, 5]),
    node(3, 'a'),
    node(4, 'b'),
    node(5, 'c'),
  ];
  const out = summarize(profile(nodes, [3, 4, 4, 5, 5, 5], 1000), ROOTS, 2);
  assert.deepEqual(out.engine, [
    { fn: 'c', selfMs: 3 },
    { fn: 'b', selfMs: 2 },
  ]);
});
