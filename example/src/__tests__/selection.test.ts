import { expect, test } from '@jest/globals';
import { describeSelection } from '../selection';

test('a caret reads line and column', () => {
  expect(describeSelection({ line: 8, column: 18 }, { line: 8, column: 18 })).toBe('Ln 8, Col 18');
});

test('a selection on one line reads its columns', () => {
  expect(describeSelection({ line: 8, column: 18 }, { line: 8, column: 25 })).toBe(
    'Ln 8, Col 18 to 25',
  );
});

test('a selection across lines reads both ends', () => {
  expect(describeSelection({ line: 8, column: 18 }, { line: 10, column: 3 })).toBe(
    'Ln 8:18 to 10:3',
  );
});
