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
  destroy() {}
}

// The core load, resolved by the test.
const mockCore: { resolve: (m: object) => void; promise: Promise<object> } = {
  resolve: () => {},
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
  mockCore.promise = new Promise((resolve) => {
    mockCore.resolve = resolve;
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
