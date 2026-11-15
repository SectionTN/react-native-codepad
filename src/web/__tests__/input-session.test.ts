import { expect, test } from '@jest/globals';
import { builtCore, loadCore } from '../../../tests/web/core';
import { EditorCore, type EditorSettings } from '../core/EditorCore';
import { type InputLike, type TextareaState, WebInputSession } from '../input/WebInputSession';
import { WINDOW_CAP } from '../input/window';

const dir = builtCore('lib/web', 'yarn build:web');
const run = dir ? test : test.skip;

async function open(text: string, caret: number, settings: Partial<EditorSettings> = {}) {
  const core = new EditorCore(await loadCore(dir as string), text);
  core.settings = { ...core.settings, ...settings };
  core.setClock(1000);
  core.setSelection(caret, caret);
  const s = new WebInputSession(core, (edit) => edit());
  s.sync();
  return { core, s };
}

const ta = (value: string, start: number, end = start): TextareaState => ({ value, start, end });
const typed = (data: string): InputLike => ({ inputType: 'insertText', data, isComposing: false });
const composed = (data: string): InputLike => ({
  inputType: 'insertCompositionText',
  data,
  isComposing: true,
});
const back: InputLike = { inputType: 'deleteContentBackward', data: null, isComposing: false };
const enter: InputLike = { inputType: 'insertLineBreak', data: null, isComposing: false };

// Types one character the way a browser reports it, from the textarea before to the textarea after.
function type(s: WebInputSession, before: TextareaState, after: TextareaState, data: string) {
  s.beforeInput(before);
  return s.input(typed(data), after);
}

run('a typed ( closes the pair and asks for a new window', async () => {
  const { core, s } = await open('', 0);
  expect(type(s, ta('', 0), ta('(', 1), '(')).toEqual(ta('()', 1));
  expect(core.text()).toBe('()');
  expect(core.selection).toEqual({ anchor: 1, head: 1 });
});

run('Enter keeps the indent', async () => {
  const { core, s } = await open('  a', 3);
  s.beforeInput(ta('  a', 3));
  s.input(enter, ta('  a\n', 4));
  expect(core.text()).toBe('  a\n  ');
  expect(core.selection.head).toBe(6);
});

run('Enter before an existing newline lands at the caret', async () => {
  const { core, s } = await open('a\nb', 1, { autoIndent: false });
  s.beforeInput(ta('a\nb', 1));
  s.input(enter, ta('a\n\nb', 2));
  expect(core.text()).toBe('a\n\nb');
  expect(core.selection.head).toBe(2);
});

run('Backspace inside an auto-closed pair deletes both', async () => {
  const { core, s } = await open('', 0);
  type(s, ta('', 0), ta('(', 1), '(');
  s.beforeInput(ta('()', 1));
  s.input(back, ta(')', 0));
  expect(core.text()).toBe('');
});

// The core starts a new undo step at a word boundary, as native does, so the emoji is a step of its own.
run('a typed emoji goes in whole and one undo takes it out whole', async () => {
  const { core, s } = await open('', 0);
  type(s, ta('', 0), ta('a', 1), 'a');
  type(s, ta('a', 1), ta('a😀', 3), '😀');
  expect(core.text()).toBe('a😀');
  expect(core.selection).toEqual({ anchor: 3, head: 3 });
  core.undo();
  expect(core.text()).toBe('a');
});

run('Backspace after an emoji removes both units', async () => {
  const { core, s } = await open('a😀', 3);
  s.beforeInput(ta('a😀', 3));
  s.input(back, ta('a', 1));
  expect(core.text()).toBe('a');
  expect(core.selection).toEqual({ anchor: 1, head: 1 });
});

run('a composed word undoes in one step', async () => {
  const { core, s } = await open('ab', 2);
  s.compositionStart(ta('ab', 2));
  s.beforeInput(ta('ab', 2));
  expect(s.input(composed('k'), ta('abk', 3))).toBeNull();
  s.beforeInput(ta('abk', 2, 3));
  expect(s.input(composed('か'), ta('abか', 3))).toBeNull();
  expect(s.composing).toEqual({ start: 2, end: 3 });
  s.compositionEnd(ta('abか', 3));
  expect(s.composing).toBeNull();
  core.undo();
  expect(core.text()).toBe('ab');
});

run('a quote typed inside a composition does not auto-close', async () => {
  const { core, s } = await open('', 0);
  s.compositionStart(ta('', 0));
  expect(s.input(composed("don'"), ta("don'", 4))).toBeNull();
  expect(core.text()).toBe("don'");
});

run('typing over a selection longer than the window replaces all of it', async () => {
  const { core, s } = await open('a'.repeat(20000), 0);
  core.selectAll();
  const window = s.sync() as TextareaState;
  expect(window.value.length).toBeLessThanOrEqual(WINDOW_CAP);
  expect([window.start, window.end]).toEqual([0, window.value.length]);
  s.beforeInput(window);
  s.input(typed('x'), ta('x', 1));
  expect(core.text()).toBe('x');
});

run('a ref edit during a composition ends it', async () => {
  const { core, s } = await open('ab', 2);
  s.compositionStart(ta('ab', 2));
  s.input(composed('か'), ta('abか', 3));
  s.external();
  core.replace(0, 0, 'Z');
  expect(s.composing).toBeNull();
  expect(s.sync()).toEqual(ta('Zabか', 4));
  core.undo();
  expect(core.text()).toBe('abか');
});

run('blur mid-composition keeps the text and closes the group', async () => {
  const { core, s } = await open('ab', 2);
  s.compositionStart(ta('ab', 2));
  s.input(composed('か'), ta('abか', 3));
  s.finishComposition();
  type(s, ta('abか', 3), ta('abかx', 4), 'x');
  core.undo();
  expect(core.text()).toBe('abか');
});

run('the browser echoing a clamped select all leaves the whole document selected', async () => {
  const text = 'x'
    .repeat(40)
    .concat('\n')
    .repeat(Math.ceil((WINDOW_CAP * 3) / 41));
  const { core, s } = await open(text, 0);
  core.selectAll();
  const written = s.sync() as TextareaState;
  expect(s.selectionChange(written)).toBeNull();
  expect(core.selection).toEqual({ anchor: 0, head: core.length });
});
