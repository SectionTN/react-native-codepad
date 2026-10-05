import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { createRef } from 'react';
import { CodeEditor } from '../CodeEditor';
import { githubLight } from '../themes/githubLight';
import type { CodeEditorRef } from '../types';

jest.mock('react-native-nitro-modules', () => ({
  getHostComponent: () => 'CodeEditorView',
  callback: (f: unknown) => ({ f }),
  NitroModules: { createHybridObject: () => ({ availableLanguages: () => [] }) },
}));

type HostProps = {
  initialValue: string;
  theme: { tokens: Record<string, { color: string; bold: boolean; italic: boolean }> };
  fontSize: number;
  lineHeight: number;
  lineNumbers: boolean;
  softWrap: boolean;
  readOnly: boolean;
  highlightActiveLine: boolean;
  placeholder?: string;
  contentInsets?: { top?: number; bottom?: number; left?: number; right?: number };
  scrollEnabled: boolean;
  onScroll: { f: (e: unknown) => void };
  onSelectionChange: { f: (s: unknown) => void };
  onReady: { f: () => void };
  hybridRef: { f: (ref: unknown) => void };
};

type Rendered = Awaited<ReturnType<typeof render>>;

// The wrapper renders exactly one host element, so the root is the native view.
const host = (api: Rendered) => {
  if (!api.root) throw new Error('no host element rendered');
  return api.root.props as HostProps;
};

describe('CodeEditor', () => {
  it('fills defaults and wraps callbacks for Nitro', async () => {
    const onReady = jest.fn();
    const props = host(await render(<CodeEditor onReady={onReady} />));
    expect(props.initialValue).toBe('');
    props.onReady.f();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(typeof props.hybridRef.f).toBe('function');
  });

  it('keeps the wrapped callbacks stable across renders and calls the latest handler', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const api = await render(<CodeEditor onReady={first} />);
    const before = host(api);
    await api.rerender(<CodeEditor onReady={second} />);
    const after = host(api);
    expect(after.onReady).toBe(before.onReady);
    expect(after.hybridRef).toBe(before.hybridRef);
    after.onReady.f();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('answers reads before the native object exists and forwards afterwards', async () => {
    const ref = createRef<CodeEditorRef>();
    const props = host(await render(<CodeEditor ref={ref} />));
    expect(ref.current?.getText()).toBe('');
    expect(ref.current?.getLineCount()).toBe(1);
    const setText = jest.fn(() => Promise.resolve());
    props.hybridRef.f({
      getText: () => 'abc',
      getLength: () => 3,
      getLineCount: () => 1,
      getLine: () => 'abc',
      getRevision: () => 0,
      setText,
    });
    expect(ref.current?.getText()).toBe('abc');
    await ref.current?.setText('x');
    expect(setText).toHaveBeenCalledWith('x', false);
    await ref.current?.setText('y', { keepHistory: true });
    expect(setText).toHaveBeenCalledWith('y', true);
  });

  it('normalizes theme tokens into structs and keeps font defaults', async () => {
    const theme = {
      ...githubLight,
      tokens: { keyword: '#f00', comment: { color: '#0f0', italic: true } },
    };
    const props = host(await render(<CodeEditor theme={theme} />));
    expect(props.theme.tokens).toEqual({
      keyword: { color: '#f00', bold: false, italic: false },
      comment: { color: '#0f0', bold: false, italic: true },
    });
    expect(props.fontSize).toBe(14);
    expect(props.lineHeight).toBe(1.4);
  });

  it('fills the view prop defaults and passes insets through', async () => {
    const props = host(await render(<CodeEditor />));
    expect(props.lineNumbers).toBe(true);
    expect(props.softWrap).toBe(false);
    expect(props.readOnly).toBe(false);
    expect(props.highlightActiveLine).toBe(true);
    expect(props.placeholder).toBeUndefined();
    expect(props.contentInsets).toBeUndefined();
    const custom = host(
      await render(<CodeEditor softWrap placeholder="Type here" contentInsets={{ bottom: 40 }} />),
    );
    expect(custom.softWrap).toBe(true);
    expect(custom.placeholder).toBe('Type here');
    expect(custom.contentInsets).toEqual({ bottom: 40 });
  });

  it('wraps the scroll and selection events once and reads the latest handlers', async () => {
    const onScroll = jest.fn();
    const onSelectionChange = jest.fn();
    const api = await render(
      <CodeEditor onScroll={onScroll} onSelectionChange={onSelectionChange} />,
    );
    const before = host(api);
    expect(before.scrollEnabled).toBe(true);
    const later = jest.fn();
    await api.rerender(<CodeEditor onScroll={later} onSelectionChange={onSelectionChange} />);
    const after = host(api);
    expect(after.onScroll).toBe(before.onScroll);
    expect(after.onSelectionChange).toBe(before.onSelectionChange);
    const event = { x: 0, y: 12, contentWidth: 100, contentHeight: 2000 };
    after.onScroll.f(event);
    expect(onScroll).not.toHaveBeenCalled();
    expect(later).toHaveBeenCalledWith(event);
    after.onSelectionChange.f({ anchor: 1, head: 4, revision: 2 });
    expect(onSelectionChange).toHaveBeenCalledWith({ anchor: 1, head: 4, revision: 2 });
  });

  it('maps the selection and scroll methods onto the native object', async () => {
    const ref = createRef<CodeEditorRef>();
    const props = host(await render(<CodeEditor ref={ref} />));
    expect(ref.current?.getSelection()).toEqual({ anchor: 0, head: 0 });
    expect(ref.current?.getCursorRect()).toBeNull();
    expect(ref.current?.getVisibleLines()).toEqual({ first: 0, last: 0 });
    const native = {
      getText: () => '',
      getLength: () => 0,
      getLineCount: () => 1,
      getLine: () => '',
      getRevision: () => 0,
      setText: jest.fn(() => Promise.resolve()),
      getSelection: () => ({ anchor: 2, head: 5, revision: 7 }),
      getTextInRange: jest.fn(() => 'bc'),
      offsetToPosition: () => ({ line: 1, column: 2 }),
      positionToOffset: jest.fn(() => 9),
      getCursorRect: () => undefined,
      getVisibleLines: () => ({ first: 3, last: 30 }),
      setSelection: jest.fn(() => Promise.resolve()),
      selectAll: jest.fn(() => Promise.resolve()),
      scrollToLine: jest.fn(() => Promise.resolve()),
      revealSelection: jest.fn(() => Promise.resolve()),
    };
    props.hybridRef.f(native);
    expect(ref.current?.getSelection()).toEqual({ anchor: 2, head: 5 });
    expect(ref.current?.getTextInRange({ start: 1, end: 3 })).toBe('bc');
    expect(native.getTextInRange).toHaveBeenCalledWith(1, 3);
    expect(ref.current?.offsetToPosition(5)).toEqual({ line: 1, column: 2 });
    expect(ref.current?.positionToOffset({ line: 1, column: 2 })).toBe(9);
    expect(native.positionToOffset).toHaveBeenCalledWith(1, 2);
    expect(ref.current?.getCursorRect()).toBeNull();
    expect(ref.current?.getVisibleLines()).toEqual({ first: 3, last: 30 });
    await ref.current?.setSelection({ anchor: 1, head: 3 });
    expect(native.setSelection).toHaveBeenCalledWith(1, 3);
    await ref.current?.scrollToLine(5);
    expect(native.scrollToLine).toHaveBeenCalledWith(5, false);
    await ref.current?.scrollToLine(6, { animated: true });
    expect(native.scrollToLine).toHaveBeenCalledWith(6, true);
    await ref.current?.selectAll();
    await ref.current?.revealSelection();
    expect(native.selectAll).toHaveBeenCalledTimes(1);
    expect(native.revealSelection).toHaveBeenCalledTimes(1);
  });
});
