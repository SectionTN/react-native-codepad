import { expect, test } from '@jest/globals';
import { githubDark } from '../../../src/themes/githubDark';
import { githubLight } from '../../../src/themes/githubLight';
import { oneDark } from '../../../src/themes/oneDark';
import { IOS, schemeFor } from '../chrome/theme';

test('light documents get the light chrome and dark documents the dark one', () => {
  expect(schemeFor(githubLight)).toBe('light');
  expect(schemeFor(githubDark)).toBe('dark');
  expect(schemeFor(oneDark)).toBe('dark');
});

test('both iOS palettes name the same roles', () => {
  expect(Object.keys(IOS.light).sort()).toEqual(Object.keys(IOS.dark).sort());
});
