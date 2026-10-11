import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { createRef } from 'react';
import { CodeEditor } from '../CodeEditor';
import type { CodeEditorViewProps } from '../specs/CodeEditorView.nitro';
import { githubLight } from '../themes/githubLight';
import type { CodeEditorProps, CodeEditorRef } from '../types';

jest.mock('react-native-nitro-modules', () => ({
  getHostComponent: () => 'CodeEditorView',
  callback: (f: unknown) => ({ f }),
  NitroModules: { createHybridObject: () => ({ availableLanguages: () => [] }) },
}));

// The mocked callback() wraps every function prop as { f }, so the host props follow the Nitro spec in that shape.
type Wrapped<T> = T extends (...args: infer A) => infer R ? { f: (...args: A) => R } : T;
type HostProps = {
  [K in keyof CodeEditorViewProps]-?: Wrapped<NonNullable<CodeEditorViewProps[K]>>;
} & { hybridRef: { f: (ref: unknown) => void } };

type Rendered = Awaited<ReturnType<typeof render>>;

// The wrapper renders exactly one host element, so the root is the native view.
const host = (api: Rendered) => {
  if (!api.root) throw new Error('no host element rendered');
  return api.root.props as HostProps;
};

describe('CodeEditor', () => {
  it('wraps every callback once and reads the latest handler', async () => {
    const rows: [keyof HostProps, (h: jest.Mock) => CodeEditorProps, unknown][] = [
      ['onReady', (h) => ({ onReady: h }), undefined],
      [
        'onScroll',
        (h) => ({ onScroll: h }),
        { x: 0, y: 12, contentWidth: 100, contentHeight: 2000 },
      ],
      ['onSelectionChange', (h) => ({ onSelectionChange: h }), { anchor: 1, head: 4, revision: 2 }],
      [
        'onChange',
        (h) => ({ onChange: h }),
        { start: 0, end: 0, text: 'a', origin: 'input', revision: 1 },
      ],
      ['onChangeText', (h) => ({ onChangeText: h }), 'a'],
      ['onEditorFocus', (h) => ({ onFocus: h }), undefined],
      ['onEditorBlur', (h) => ({ onBlur: h }), undefined],
      ['onContentSizeChange', (h) => ({ onContentSizeChange: h }), { width: 360, height: 1200 }],
    ];
    for (const [hostProp, props, payload] of rows) {
      const first = jest.fn();
      const second = jest.fn();
      const api = await render(<CodeEditor {...props(first)} />);
      const before = host(api);
      await api.rerender(<CodeEditor {...props(second)} />);
      const after = host(api);
      expect(after[hostProp]).toBe(before[hostProp]);
      expect(after.hybridRef).toBe(before.hybridRef);
      (after[hostProp] as { f: (p?: unknown) => void }).f(payload);
      expect(first).not.toHaveBeenCalled();
      if (payload === undefined) expect(second).toHaveBeenCalledTimes(1);
      else expect(second).toHaveBeenCalledWith(payload);
    }
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

  it('normalizes theme tokens into structs', async () => {
    const theme = {
      ...githubLight,
      tokens: { keyword: '#f00', comment: { color: '#0f0', italic: true } },
    };
    const props = host(await render(<CodeEditor theme={theme} />));
    expect(props.theme.tokens).toEqual({
      keyword: { color: '#f00', bold: false, italic: false },
      comment: { color: '#0f0', bold: false, italic: true },
    });
  });

  it('fills the prop defaults and passes explicit values through', async () => {
    const props = host(await render(<CodeEditor />));
    expect(props).toMatchObject({
      initialValue: '',
      fontSize: 14,
      lineHeight: 1.4,
      lineNumbers: true,
      softWrap: false,
      readOnly: false,
      highlightActiveLine: true,
      matchBrackets: true,
      scrollEnabled: true,
      avoidKeyboard: false,
      tabSize: 4,
      insertSpaces: true,
      autoIndent: true,
      autoCloseBrackets: true,
      suggestions: 'off',
      autoFocus: false,
    });
    expect(props.placeholder).toBeUndefined();
    expect(props.contentInsets).toBeUndefined();
    expect(props.onChangeText).toBeUndefined();
    const custom = host(
      await render(
        <CodeEditor
          softWrap
          matchBrackets={false}
          avoidKeyboard
          placeholder="Type here"
          contentInsets={{ bottom: 40 }}
        />,
      ),
    );
    expect(custom).toMatchObject({
      softWrap: true,
      matchBrackets: false,
      avoidKeyboard: true,
      placeholder: 'Type here',
      contentInsets: { bottom: 40 },
    });
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

  it('maps the editing methods onto the native object', async () => {
    const ref = createRef<CodeEditorRef>();
    const props = host(await render(<CodeEditor ref={ref} />));
    expect(ref.current?.canUndo()).toBe(false);
    expect(ref.current?.isFocused()).toBe(false);
    await ref.current?.undo();
    const native = {
      canUndo: () => true,
      canRedo: () => false,
      isFocused: () => true,
      replaceRange: jest.fn(() => Promise.resolve()),
      insertText: jest.fn(() => Promise.resolve()),
      undo: jest.fn(() => Promise.resolve()),
      redo: jest.fn(() => Promise.resolve()),
      indent: jest.fn(() => Promise.resolve()),
      outdent: jest.fn(() => Promise.resolve()),
      cut: jest.fn(() => Promise.resolve()),
      copy: jest.fn(() => Promise.resolve()),
      paste: jest.fn(() => Promise.resolve()),
      focus: jest.fn(() => Promise.resolve()),
      blur: jest.fn(() => Promise.resolve()),
    };
    props.hybridRef.f(native);
    expect(ref.current?.canUndo()).toBe(true);
    expect(ref.current?.canRedo()).toBe(false);
    expect(ref.current?.isFocused()).toBe(true);
    await ref.current?.replaceRange({ start: 1, end: 3 }, 'xy');
    expect(native.replaceRange).toHaveBeenCalledWith(1, 3, 'xy');
    await ref.current?.insertText('q');
    expect(native.insertText).toHaveBeenCalledWith('q');
    await ref.current?.undo();
    await ref.current?.redo();
    await ref.current?.indent();
    await ref.current?.outdent();
    await ref.current?.cut();
    await ref.current?.copy();
    await ref.current?.paste();
    await ref.current?.focus();
    await ref.current?.blur();
    for (const fn of [
      native.undo,
      native.redo,
      native.indent,
      native.outdent,
      native.cut,
      native.copy,
      native.paste,
      native.focus,
      native.blur,
    ]) {
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it('maps the search methods onto the native object', async () => {
    const ref = createRef<CodeEditorRef>();
    const props = host(await render(<CodeEditor ref={ref} />));
    expect(await ref.current?.setSearch({ text: 'ab' })).toEqual({ count: 0 });
    expect(await ref.current?.findNext()).toBeNull();
    expect(await ref.current?.findPrevious()).toBeNull();
    expect(await ref.current?.replaceCurrent('x')).toBe(false);
    expect(await ref.current?.replaceAll('x')).toBe(0);
    await ref.current?.clearSearch();
    const native = {
      setSearch: jest.fn(() => Promise.resolve(3)),
      findNext: jest.fn(() => Promise.resolve({ index: -1, total: 0 })),
      findPrevious: jest.fn(() => Promise.resolve({ index: 1, total: 3 })),
      replaceCurrent: jest.fn(() => Promise.resolve(true)),
      replaceAll: jest.fn(() => Promise.resolve(2)),
      clearSearch: jest.fn(() => Promise.resolve()),
    };
    props.hybridRef.f(native);
    expect(await ref.current?.setSearch({ text: 'ab' })).toEqual({ count: 3 });
    expect(native.setSearch).toHaveBeenCalledWith({
      text: 'ab',
      regex: false,
      caseSensitive: false,
      wholeWord: false,
    });
    await ref.current?.setSearch({ text: 'a.', regex: true, caseSensitive: true, wholeWord: true });
    expect(native.setSearch).toHaveBeenLastCalledWith({
      text: 'a.',
      regex: true,
      caseSensitive: true,
      wholeWord: true,
    });
    // Nitro cannot cross null inside a struct, so a total of 0 is the no-match sentinel.
    expect(await ref.current?.findNext()).toBeNull();
    expect(await ref.current?.findPrevious()).toEqual({ index: 1, total: 3 });
    expect(await ref.current?.replaceCurrent('x')).toBe(true);
    expect(native.replaceCurrent).toHaveBeenCalledWith('x');
    expect(await ref.current?.replaceAll('y')).toBe(2);
    expect(native.replaceAll).toHaveBeenCalledWith('y');
    await ref.current?.clearSearch();
    expect(native.clearSearch).toHaveBeenCalledTimes(1);
  });

  it('maps the caret and typing methods onto the native object', async () => {
    const ref = createRef<CodeEditorRef>();
    const props = host(await render(<CodeEditor ref={ref} />));
    await ref.current?.moveCaret('left');
    await ref.current?.typeText('a');
    await ref.current?.deleteBackward();
    await ref.current?.deleteForward();
    const native = {
      moveCaret: jest.fn(() => Promise.resolve()),
      typeText: jest.fn(() => Promise.resolve()),
      deleteBackward: jest.fn(() => Promise.resolve()),
      deleteForward: jest.fn(() => Promise.resolve()),
    };
    props.hybridRef.f(native);
    await ref.current?.moveCaret('up');
    expect(native.moveCaret).toHaveBeenCalledWith('up', false);
    await ref.current?.moveCaret('wordRight', { select: true });
    expect(native.moveCaret).toHaveBeenLastCalledWith('wordRight', true);
    await ref.current?.typeText('{');
    expect(native.typeText).toHaveBeenCalledWith('{');
    await ref.current?.deleteBackward();
    await ref.current?.deleteForward();
    expect(native.deleteBackward).toHaveBeenCalledTimes(1);
    expect(native.deleteForward).toHaveBeenCalledTimes(1);
  });
});
