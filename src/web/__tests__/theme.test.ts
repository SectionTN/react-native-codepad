import { expect, test } from '@jest/globals';
import { githubLight } from '../../themes/githubLight';
import { cssTheme } from '../theme';

test('keeps the six accepted formats', () => {
  const css = cssTheme({
    ...githubLight,
    background: '#abc',
    foreground: '#abcd',
    cursor: '#aabbcc',
    selection: '#aabbcc80',
    activeLine: 'rgb(1, 2, 3)',
    searchMatch: 'rgba(1,2,3,0.5)',
  });
  expect(css.background).toBe('#abc');
  expect(css.foreground).toBe('#abcd');
  expect(css.cursor).toBe('#aabbcc');
  expect(css.selection).toBe('#aabbcc80');
  expect(css.activeLine).toBe('rgb(1, 2, 3)');
  expect(css.searchMatch).toBe('rgba(1,2,3,0.5)');
});

test('falls back to the githubLight color of the key', () => {
  const css = cssTheme({
    ...githubLight,
    background: 'red',
    cursor: '#12345',
    gutterForeground: '',
  });
  expect(css.background).toBe(githubLight.background);
  expect(css.cursor).toBe(githubLight.cursor);
  expect(css.gutterForeground).toBe(githubLight.gutterForeground);
});

test('falls back to githubLight.foreground for a token', () => {
  const css = cssTheme({
    ...githubLight,
    tokens: { keyword: 'nope', string: { color: 'blue', bold: true }, number: '#0550ae' },
  });
  expect(css.token('keyword.function')).toEqual({
    color: githubLight.foreground,
    bold: false,
    italic: false,
  });
  expect(css.token('string')).toEqual({ color: githubLight.foreground, bold: true, italic: false });
  expect(css.token('number')).toEqual({ color: '#0550ae', bold: false, italic: false });
  expect(css.token('variable')).toBeNull();
});
