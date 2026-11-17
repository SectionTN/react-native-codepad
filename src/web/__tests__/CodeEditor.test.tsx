import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { createRef } from 'react';
import type { CodeEditorRef } from '../../types';
import type { ViewOptions } from '../EditorView';

// A view that draws in the microtask after its construction, as the page pump draws before React commits.
const mockViews: MockView[] = [];
class MockView {
  options: Partial<ViewOptions> = {};
  language = '';
  written: string[] = [];
  core = {
    text: jest.fn(() => this.written.join('')),
    setText: jest.fn((text: string) => this.written.push(text)),
  };
  constructor(_host: unknown, _m: unknown, text = '') {
    this.written.push(text);
    mockViews.push(this);
    queueMicrotask(() => this.options.onFirstDraw?.());
  }
  setOptions(next: Partial<ViewOptions>) {
    this.options = { ...this.options, ...next };
  }
  setLanguage(id: string) {
    this.language = id;
  }
  apply(edit: () => void) {
    edit();
  }
  focused = false;
  focus = jest.fn(() => {
    this.focused = true;
    this.options.onFocus?.();
  });
  blur = jest.fn(() => {
    this.focused = false;
    this.options.onBlur?.();
  });
  typeText = jest.fn();
  deleteBackward = jest.fn();
  deleteForward = jest.fn();
  moveCaret = jest.fn();
  setDecorations = jest.fn();
  gapRect = jest.fn(() => null);
  destroy() {}
}

// The core load, resolved by the test.
const mockCore: {
  resolve: (m: object) => void;
  reject: (e: Error) => void;
  promise: Promise<object>;
} = {
  resolve: () => {},
  reject: () => {},
  promise: Promise.resolve({}),
};

jest.mock('../EditorView', () => ({ EditorView: MockView }));
jest.mock('../loader', () => ({ loadCore: () => mockCore.promise }));

const { CodeEditor } = require('../CodeEditor') as typeof import('../CodeEditor');

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function settled<T>(promise: Promise<T>): Promise<T | 'hung'> {
  return Promise.race([promise, new Promise<'hung'>((r) => setTimeout(() => r('hung'), 100))]);
}

beforeEach(() => {
  mockViews.length = 0;
  mockCore.promise = new Promise((resolve, reject) => {
    mockCore.resolve = resolve;
    mockCore.reject = reject;
  });
});

test('fires onReady when the first draw comes before React commits the view', async () => {
  const onReady = jest.fn();
  await render(<CodeEditor language="python" onReady={onReady} />);
  await act(async () => {
    mockCore.resolve({});
    await tick();
  });
  expect(mockViews).toHaveLength(1);
  expect(mockViews[0]?.language).toBe('python');
  expect(onReady).toHaveBeenCalledTimes(1);
});

test('applies a write made before the core loads once it does', async () => {
  const ref = createRef<CodeEditorRef>();
  await render(<CodeEditor ref={ref} />);
  const write = ref.current?.setText('saved');
  await act(async () => {
    mockCore.resolve({});
    await tick();
  });
  await expect(settled(write as Promise<void>)).resolves.toBeUndefined();
  expect(mockViews[0]?.core.setText).toHaveBeenCalledWith('saved', false);
});

test('settles a write left waiting when the editor unmounts before the core loads', async () => {
  const ref = createRef<CodeEditorRef>();
  const api = await render(<CodeEditor ref={ref} />);
  const write = ref.current?.setText('lost');
  await api.unmount();
  await expect(settled(write as Promise<void>)).resolves.toBeUndefined();
  mockCore.resolve({});
  await tick();
  expect(mockViews).toHaveLength(0);
});

test('a handle kept after unmount neither reads nor writes the closed editor', async () => {
  const ref = createRef<CodeEditorRef>();
  const api = await render(<CodeEditor ref={ref} initialValue="first" />);
  await act(async () => {
    mockCore.resolve({});
    await tick();
  });
  const handle = ref.current as CodeEditorRef;
  const view = mockViews[0] as MockView;
  expect(handle.getText()).toBe('first');
  view.core.text.mockClear();
  await api.unmount();
  await handle.setText('late');
  expect(handle.getText()).toBe('');
  expect(view.core.setText).not.toHaveBeenCalled();
  expect(view.core.text).not.toHaveBeenCalled();
});

test('settles a write made after the core failed to load', async () => {
  const ref = createRef<CodeEditorRef>();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await render(<CodeEditor ref={ref} />);
  await act(async () => {
    mockCore.reject(new Error('[codepad] could not load /codepad/codepad.js'));
    await tick();
  });
  const write = ref.current?.setText('late');
  await expect(settled(write as Promise<void>)).resolves.toBeUndefined();
  warn.mockRestore();
});

test('focus and blur reach the view, isFocused reads it, and onFocus and onBlur fire', async () => {
  const ref = createRef<CodeEditorRef>();
  const onFocus = jest.fn();
  const onBlur = jest.fn();
  await render(<CodeEditor ref={ref} onFocus={onFocus} onBlur={onBlur} />);
  await act(async () => {
    mockCore.resolve({});
    await tick();
  });
  await ref.current?.focus();
  expect(mockViews[0]?.focus).toHaveBeenCalledTimes(1);
  expect(ref.current?.isFocused()).toBe(true);
  await ref.current?.blur();
  expect(ref.current?.isFocused()).toBe(false);
  expect([onFocus.mock.calls.length, onBlur.mock.calls.length]).toEqual([1, 1]);
});

test('typeText, deleteBackward, deleteForward and moveCaret made before the core loads reach the view', async () => {
  const ref = createRef<CodeEditorRef>();
  await render(<CodeEditor ref={ref} />);
  const calls = [
    ref.current?.typeText('x'),
    ref.current?.deleteBackward(),
    ref.current?.deleteForward(),
    ref.current?.moveCaret('pageDown', { select: true }),
  ];
  await act(async () => {
    mockCore.resolve({});
    await tick();
  });
  await expect(settled(Promise.all(calls))).resolves.not.toBe('hung');
  const view = mockViews[0] as MockView;
  expect(view.typeText).toHaveBeenCalledWith('x');
  expect(view.deleteBackward).toHaveBeenCalledTimes(1);
  expect(view.deleteForward).toHaveBeenCalledTimes(1);
  expect(view.moveCaret).toHaveBeenCalledWith('pageDown', true);
});

test('focus called before the core loads focuses the editor once it does', async () => {
  const ref = createRef<CodeEditorRef>();
  await render(<CodeEditor ref={ref} />);
  const focused = ref.current?.focus();
  await act(async () => {
    mockCore.resolve({});
    await tick();
  });
  await expect(settled(focused as Promise<void>)).resolves.toBeUndefined();
  expect(mockViews[0]?.focus).toHaveBeenCalledTimes(1);
});

test('decorations passed before the core loads apply once it does', async () => {
  const items = [{ kind: 'gap' as const, line: 0, rows: 2 }];
  await render(<CodeEditor decorations={items} decorationsRevision={3} />);
  await act(async () => {
    mockCore.resolve({});
    await tick();
  });
  expect(mockViews[0]?.setDecorations).toHaveBeenCalledWith(items, 3);
});

test('decorations without a revision are for the current text', async () => {
  const items = [{ kind: 'lineBackground' as const, line: 1, color: 'red' }];
  await render(<CodeEditor decorations={items} />);
  await act(async () => {
    mockCore.resolve({});
    await tick();
  });
  expect(mockViews[0]?.setDecorations).toHaveBeenCalledWith(items, -1);
});
