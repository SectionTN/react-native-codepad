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
});
