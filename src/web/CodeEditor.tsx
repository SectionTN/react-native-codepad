/// <reference lib="dom" />
import {
  type ComponentRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { githubLight } from '../themes/githubLight';
import type { CodeEditorProps, CodeEditorRef, ContentInsets } from '../types';
import { EditorView, type ViewOptions } from './EditorView';
import { loadCore } from './loader';

const NO_INSETS: ContentInsets = {};
const warned = new Set<string>();

// Methods, props and events plans 2 and 3 bring to the web. Each warns once per page.
function notYet(name: string): void {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(`[codepad] ${name} is not available on web yet`);
}

function later<T>(name: string, value: T): Promise<T> {
  notYet(name);
  return Promise.resolve(value);
}

// The editor on react-native-web: a View whose node holds lines drawn from the WASM core, outside React's render.
export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(function CodeEditor(
  {
    initialValue = '',
    language = '',
    theme = githubLight,
    fontFamily = '',
    fontSize = 14,
    lineHeight = 1.4,
    lineNumbers = true,
    softWrap = false,
    readOnly = false,
    highlightActiveLine = true,
    matchBrackets = true,
    placeholder = '',
    scrollEnabled = true,
    contentInsets = NO_INSETS,
    textPadding = 8,
    avoidKeyboard = false,
    tabSize = 4,
    insertSpaces = true,
    autoIndent = true,
    autoCloseBrackets = true,
    suggestions = 'off',
    autoFocus = false,
    onReady,
    onScroll,
    onSelectionChange,
    onChange,
    onChangeText,
    onFocus,
    onBlur,
    onContentSizeChange,
    decorations,
    decorationsRevision: _decorationsRevision,
    onGapLayout,
    ...viewProps
  },
  ref,
) {
  const node = useRef<ComponentRef<typeof View>>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const handlers = useRef({
    onReady,
    onScroll,
    onSelectionChange,
    onChange,
    onChangeText,
    onContentSizeChange,
  });
  handlers.current = {
    onReady,
    onScroll,
    onSelectionChange,
    onChange,
    onChangeText,
    onContentSizeChange,
  };
  const initial = useRef(initialValue);

  useEffect(() => {
    let alive = true;
    let created: EditorView | null = null;
    loadCore().then(
      (m) => {
        const host = node.current as unknown as HTMLElement | null;
        if (!alive || !host) return;
        created = new EditorView(host, m, initial.current);
        setView(created);
      },
      (e: Error) => console.warn(e.message),
    );
    return () => {
      alive = false;
      created?.destroy();
    };
  }, []);

  useEffect(() => {
    if (avoidKeyboard) notYet('avoidKeyboard');
    if (autoFocus) notYet('autoFocus');
    if (suggestions !== 'off') notYet('suggestions');
    if (decorations) notYet('decorations');
    if (onGapLayout) notYet('onGapLayout');
    if (onFocus) notYet('onFocus');
    if (onBlur) notYet('onBlur');
  }, [avoidKeyboard, autoFocus, suggestions, decorations, onGapLayout, onFocus, onBlur]);

  useEffect(() => {
    if (!view) return;
    const options: Partial<ViewOptions> = {
      theme,
      fontFamily,
      fontSize,
      lineHeight,
      lineNumbers,
      softWrap,
      highlightActiveLine,
      matchBrackets,
      textPadding,
      contentInsets,
      scrollEnabled,
      placeholder,
      readOnly,
      tabSize,
      insertSpaces,
      autoIndent,
      autoCloseBrackets,
      onContentSize: (width, height) => handlers.current.onContentSizeChange?.({ width, height }),
      onScroll: (x, y) =>
        handlers.current.onScroll?.({
          x,
          y,
          contentWidth: view.layout.contentWidth,
          contentHeight: view.layout.contentHeight,
        }),
      onFirstDraw: () => handlers.current.onReady?.(),
      onChange: (c) => {
        const h = handlers.current;
        h.onChange?.({
          start: c.start,
          end: c.start + c.removedLength,
          text: c.inserted,
          origin: c.origin,
          revision: c.revision,
        });
        h.onChangeText?.(view.core.text());
      },
      onSelection: (anchor, head, revision) =>
        handlers.current.onSelectionChange?.({ anchor, head, revision }),
    };
    view.setOptions(options);
  }, [
    view,
    theme,
    fontFamily,
    fontSize,
    lineHeight,
    lineNumbers,
    softWrap,
    highlightActiveLine,
    matchBrackets,
    textPadding,
    contentInsets,
    scrollEnabled,
    placeholder,
    readOnly,
    tabSize,
    insertSpaces,
    autoIndent,
    autoCloseBrackets,
  ]);

  useEffect(() => {
    view?.setLanguage(language);
  }, [view, language]);

  // Until the core loads, reads see an empty document and writes do nothing, like native before onReady.
  useImperativeHandle(ref, () => {
    const core = view?.core;
    const write = (edit: (v: EditorView) => void): Promise<void> => {
      if (view) view.apply(() => edit(view));
      return Promise.resolve();
    };
    return {
      getText: () => core?.text() ?? '',
      getTextInRange: (range) => core?.text(range.start, range.end) ?? '',
      getLength: () => core?.length ?? 0,
      getLineCount: () => core?.lineCount ?? 1,
      getLine: (index) => core?.line(index) ?? '',
      getSelection: () => core?.selection ?? { anchor: 0, head: 0 },
      getRevision: () => core?.revision ?? 0,
      offsetToPosition: (offset) => core?.offsetToPosition(offset) ?? { line: 0, column: 0 },
      positionToOffset: (pos) => core?.positionToOffset(pos.line, pos.column) ?? 0,
      getCursorRect: () => (view && core ? view.caretRect(core.selection.head) : null),
      getGapRect: () => {
        notYet('getGapRect');
        return null;
      },
      getVisibleLines: () => view?.visibleLines() ?? { first: 0, last: 0 },
      canUndo: () => core?.canUndo ?? false,
      canRedo: () => core?.canRedo ?? false,
      isFocused: () => false,
      setText: (text, opts) => write((v) => v.core.setText(text, opts?.keepHistory ?? false)),
      setSelection: (sel) => write((v) => v.core.setSelection(sel.anchor, sel.head)),
      selectAll: () => write((v) => v.core.selectAll()),
      scrollToLine: (line) => {
        view?.scrollToLine(line);
        return Promise.resolve();
      },
      revealSelection: () => {
        view?.revealSelection();
        return Promise.resolve();
      },
      replaceRange: (range, text) => write((v) => v.core.replace(range.start, range.end, text)),
      insertText: (text) => write((v) => v.core.insertText(text)),
      undo: () => write((v) => v.core.undo()),
      redo: () => write((v) => v.core.redo()),
      indent: () => write((v) => v.core.indent()),
      outdent: () => write((v) => v.core.outdent()),
      cut: () => later('cut', undefined),
      copy: () => later('copy', undefined),
      paste: () => later('paste', undefined),
      focus: () => later('focus', undefined),
      blur: () => later('blur', undefined),
      setSearch: () => later('setSearch', { count: 0, limited: false }),
      findNext: () => later('findNext', null),
      findPrevious: () => later('findPrevious', null),
      replaceCurrent: () => later('replaceCurrent', false),
      replaceAll: () => later('replaceAll', 0),
      clearSearch: () => later('clearSearch', undefined),
      moveCaret: () => later('moveCaret', undefined),
      typeText: () => later('typeText', undefined),
      deleteBackward: () => later('deleteBackward', undefined),
      deleteForward: () => later('deleteForward', undefined),
    };
  }, [view]);

  return <View {...viewProps} ref={node} />;
});
