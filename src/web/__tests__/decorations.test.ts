import { expect, test } from '@jest/globals';
import { solidTop, wavePath } from '../decorations';

test('a wave starts on the centre line heading down, half a wavelength per curve', () => {
  const d = wavePath(0, 10, 5, 1);
  // Thickness 1: half wavelength (4 + 0.375) / 2, swing 0.875 drawn as a control point twice as far.
  expect(d.startsWith('M0 5 Q1.09375 6.75 2.1875 5 Q3.28125 3.25 4.375 5')).toBe(true);
  const ends = [...d.matchAll(/Q\S+ \S+ (\S+) /g)].map((m) => Number(m[1]));
  expect(ends).toHaveLength(5);
  expect(ends.at(-1)).toBeGreaterThanOrEqual(10);
});

test('a wave scales with the thickness', () => {
  const d = wavePath(4, 6, 0, 2);
  expect(d.startsWith('M4 0 Q6.09375 3.5 8.1875 0')).toBe(true);
});

test('a solid underline sits offset below the baseline, on a whole pixel', () => {
  expect(solidTop(20, 14.6, 2)).toBe(37);
  expect(solidTop(0, 14.4, 2)).toBe(16);
});
