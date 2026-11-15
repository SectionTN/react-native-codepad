import { expect, test } from '@jest/globals';
import { keyboardOverlap } from '../input/keyboardInset';

test('the keyboard covers what lies below the visual viewport', () => {
  expect(keyboardOverlap(800, 0, 500, 900)).toBe(300);
  expect(keyboardOverlap(400, 0, 500, 900)).toBe(0);
  expect(keyboardOverlap(800, 100, 500, 900)).toBe(200);
});

test('an editor that runs past the window with no keyboard gets no inset', () => {
  expect(keyboardOverlap(1100, 0, 900, 900)).toBe(0);
  expect(keyboardOverlap(1100, 0, 500, 900)).toBe(400);
});
