import { expect, test } from '@jest/globals';
import { decodeFrame } from '../frame';

const units = (s: string) => Uint16Array.from(s, (c) => c.charCodeAt(0));
// revision, length, line_count, anchor, head, caret_line, decorations_version, history, first, last
const header = (lineCount: number, first: number, last: number) => [
  3,
  11,
  lineCount,
  2,
  4,
  0,
  1,
  1,
  first,
  last,
];

test('decodes a frame with one run of two lines', () => {
  const ints = Int32Array.from([
    ...header(2, 0, 1),
    ...[0, 6, 12],
    ...[1, 0, 1],
    ...[1, 0, 3, 7],
    ...[0],
    ...[0, 5, 5, 5],
  ]);
  const frame = decodeFrame(ints, units('def ab = 1'));
  expect(frame).toMatchObject({ revision: 3, length: 11, lineCount: 2, anchor: 2, head: 4 });
  expect(frame).toMatchObject({ decorationsVersion: 1, history: 1, first: 0, last: 1 });
  expect(frame.lineStarts).toEqual([0, 6, 12]);
  expect(frame.runs).toHaveLength(1);
  const [run] = frame.runs;
  expect(run?.lo).toBe(0);
  expect(run?.hi).toBe(1);
  expect(run?.lines.map((l) => l.text)).toEqual(['def a', 'b = 1']);
  expect(run?.lines.map((l) => Array.from(l.spans))).toEqual([[0, 3, 7], []]);
});

test('decodes a frame with no runs', () => {
  const frame = decodeFrame(Int32Array.from([...header(1, 0, 0), 0, 4, 0]), units(''));
  expect(frame.lineStarts).toEqual([0, 4]);
  expect(frame.runs).toEqual([]);
});
