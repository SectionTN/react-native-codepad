import { expect, test } from '@jest/globals';
import { keyboardOverlap } from '../input/keyboardInset';

test('the keyboard covers what lies below the visual viewport', () => {
  expect(keyboardOverlap(800, 0, 500)).toBe(300);
  expect(keyboardOverlap(400, 0, 500)).toBe(0);
  expect(keyboardOverlap(800, 100, 500)).toBe(200);
});
