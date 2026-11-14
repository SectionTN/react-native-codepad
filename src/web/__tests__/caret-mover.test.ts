import { expect, test } from '@jest/globals';
import { CaretMover, type DocLike, type LineGeometry } from '../input/CaretMover';

// Lines laid out in rows of width columns, each column 10 pixels wide.
function fixture(lines: string[], width: number): { doc: DocLike; geometry: LineGeometry } {
  const starts = lines.map((_, i) => lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0));
  const doc: DocLike = {
    lineCount: lines.length,
    length: lines.join('\n').length,
    lineAt: (offset) => starts.filter((s) => s <= offset).length - 1,
    lineStart: (line) => starts[line] as number,
  };
  const len = (line: number) => (lines[line] as string).length;
  const geometry: LineGeometry = {
    rows: (line) => Math.max(1, Math.ceil(len(line) / width)),
    rowOf: (line, column) => Math.min(Math.floor(column / width), geometry.rows(line) - 1),
    caretX: (line, column) => (column - geometry.rowOf(line, column) * width) * 10,
    columnAt: (line, row, x) => Math.min(row * width + Math.round(x / 10), len(line)),
  };
  return { doc, geometry };
}

test('Down walks the rows of a wrapped line before the next line, keeping the goal x', () => {
  const { doc, geometry } = fixture(['abcdefghij', 'xy', 'abcdefgh'], 4);
  const mover = new CaretMover();
  const a = mover.target(doc, geometry, 1, 1);
  expect(a).toBe(5);
  const b = mover.target(doc, geometry, a, 1);
  expect(b).toBe(9);
  const c = mover.target(doc, geometry, b, 1);
  expect(c).toBe(12);
  expect(mover.target(doc, geometry, c, 1)).toBe(15);
});

test('Up from the first row goes to the start and Down from the last row to the end', () => {
  const { doc, geometry } = fixture(['abc', 'def'], 80);
  const mover = new CaretMover();
  expect(mover.target(doc, geometry, 2, -1)).toBe(0);
  expect(mover.target(doc, geometry, 5, 3)).toBe(7);
});

test('reset drops the goal x', () => {
  const { doc, geometry } = fixture(['abcdef', 'ab', 'abcdef'], 80);
  const mover = new CaretMover();
  expect(mover.target(doc, geometry, 5, 1)).toBe(9);
  expect(mover.target(doc, geometry, 9, 1)).toBe(15);
  mover.reset();
  expect(mover.target(doc, geometry, 9, 1)).toBe(12);
});
