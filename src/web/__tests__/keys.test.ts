import { expect, test } from '@jest/globals';
import { type KeyLike, keyCommand } from '../input/keys';

const key = (name: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: name,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  isComposing: false,
  ...mods,
});
const move = (unit: string, forward: boolean, extend = false) => ({
  kind: 'move',
  unit,
  forward,
  extend,
});

test('arrows move by character, word and line with the platform modifier', () => {
  expect(keyCommand(key('ArrowLeft'), true)).toEqual(move('char', false));
  expect(keyCommand(key('ArrowRight'), false)).toEqual(move('char', true));
  expect(keyCommand(key('ArrowLeft', { altKey: true }), true)).toEqual(move('word', false));
  expect(keyCommand(key('ArrowLeft', { ctrlKey: true }), false)).toEqual(move('word', false));
  expect(keyCommand(key('ArrowRight', { metaKey: true }), true)).toEqual(move('lineEnd', true));
  expect(keyCommand(key('ArrowLeft', { metaKey: true }), true)).toEqual(move('lineStart', false));
  expect(keyCommand(key('Home'), false)).toEqual(move('lineStart', false));
  expect(keyCommand(key('End'), true)).toEqual(move('lineEnd', true));
  expect(keyCommand(key('Home', { ctrlKey: true }), false)).toEqual(move('docStart', false));
  expect(keyCommand(key('ArrowUp', { metaKey: true }), true)).toEqual(move('docStart', false));
  expect(keyCommand(key('ArrowDown', { metaKey: true }), true)).toEqual(move('docEnd', true));
});

test('Shift extends every move', () => {
  expect(keyCommand(key('ArrowLeft', { shiftKey: true }), true)).toEqual(move('char', false, true));
  expect(keyCommand(key('End', { shiftKey: true, ctrlKey: true }), false)).toEqual(
    move('docEnd', true, true),
  );
  expect(keyCommand(key('ArrowDown', { shiftKey: true }), false)).toEqual({
    kind: 'vertical',
    by: 'row',
    forward: true,
    extend: true,
  });
});

test('Up, Down, PageUp and PageDown move vertically', () => {
  expect(keyCommand(key('ArrowUp'), false)).toEqual({
    kind: 'vertical',
    by: 'row',
    forward: false,
    extend: false,
  });
  expect(keyCommand(key('PageDown'), true)).toEqual({
    kind: 'vertical',
    by: 'page',
    forward: true,
    extend: false,
  });
});

test('Tab, undo, redo and select all follow the platform', () => {
  expect(keyCommand(key('Tab'), true)).toEqual({ kind: 'tab' });
  expect(keyCommand(key('Tab', { shiftKey: true }), false)).toEqual({ kind: 'shiftTab' });
  expect(keyCommand(key('z', { metaKey: true }), true)).toEqual({ kind: 'undo' });
  expect(keyCommand(key('Z', { metaKey: true, shiftKey: true }), true)).toEqual({ kind: 'redo' });
  expect(keyCommand(key('z', { ctrlKey: true }), false)).toEqual({ kind: 'undo' });
  expect(keyCommand(key('Z', { ctrlKey: true, shiftKey: true }), false)).toEqual({
    kind: 'redo',
  });
  expect(keyCommand(key('y', { ctrlKey: true }), false)).toEqual({ kind: 'redo' });
  expect(keyCommand(key('a', { metaKey: true }), true)).toEqual({ kind: 'selectAll' });
  expect(keyCommand(key('a', { ctrlKey: true }), false)).toEqual({ kind: 'selectAll' });
});

test('a shortcut on a layout whose key is not a Latin letter reads the physical key', () => {
  expect(keyCommand(key('ئ', { metaKey: true, code: 'KeyZ' }), true)).toEqual({ kind: 'undo' });
});

test('keys the textarea handles itself, and every key while composing, give null', () => {
  for (const k of [
    key('Enter'),
    key('Backspace'),
    key('Delete'),
    key('Unidentified'),
    key('Process'),
    key('a'),
    key('z', { ctrlKey: true }),
    key('y', { metaKey: true }),
    key('Tab', { ctrlKey: true }),
    key('ArrowLeft', { isComposing: true }),
    key('ArrowLeft', { keyCode: 229 }),
  ]) {
    expect(keyCommand(k, true)).toBeNull();
  }
  expect(keyCommand(key('z', { metaKey: true }), false)).toBeNull();
  expect(keyCommand(key('ArrowLeft', { altKey: true }), false)).toBeNull();
});
