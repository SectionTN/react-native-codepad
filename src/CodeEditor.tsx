import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { callback, getHostComponent } from 'react-native-nitro-modules';
import type {
  CodeEditorViewMethods,
  CodeEditorViewProps,
  NativeChangeEvent,
  NativeScrollEvent,
  NativeSelection,
  NativeTheme,
  NativeTokenStyle,
} from './specs/CodeEditorView.nitro';
import CodeEditorViewConfig from './specs/CodeEditorViewConfig';
import { githubLight } from './themes/githubLight';
import type { CodeEditorProps, CodeEditorRef, Theme } from './types';

const NativeCodeEditor = getHostComponent<CodeEditorViewProps, CodeEditorViewMethods>(
  'CodeEditorView',
  () => CodeEditorViewConfig,
);

type NativeRef = CodeEditorViewMethods;

/** Every token crosses to native as a full struct. The string shorthand exists only in TypeScript. */
export function normalizeTheme(theme: Theme): NativeTheme {
  const tokens: Record<string, NativeTokenStyle> = {};
  for (const [name, style] of Object.entries(theme.tokens)) {
    tokens[name] =
      typeof style === 'string'
        ? { color: style, bold: false, italic: false }
        : { color: style.color, bold: style.bold ?? false, italic: style.italic ?? false };
  }
  const { tokens: _tokens, ...colors } = theme;
  return { ...colors, tokens };
}

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(function CodeEditor(
  {
    initialValue = '',
    language,
    theme = githubLight,
    fontFamily,
    fontSize = 14,
    lineHeight = 1.4,
    lineNumbers = true,
    softWrap = false,
    readOnly = false,
    highlightActiveLine = true,
    placeholder,
    scrollEnabled = true,
    contentInsets,
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
    ...viewProps
  },
  ref,
) {
  const native = useRef<NativeRef | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onChangeTextRef = useRef(onChangeText);
  onChangeTextRef.current = onChangeText;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;
  const nativeTheme = useMemo(() => normalizeTheme(theme), [theme]);

  // Nitro re-sends a function prop and re-invokes hybridRef whenever the wrapped object changes,
  // so every callback() is created once and reads the latest handler through a ref.
  const hybridRef = useMemo(
    () =>
      callback((r: NativeRef) => {
        native.current = r;
      }),
    [],
  );
  const onReadyCallback = useMemo(() => callback(() => onReadyRef.current?.()), []);
  const onScrollCallback = useMemo(
    () => callback((e: NativeScrollEvent) => onScrollRef.current?.(e)),
    [],
  );
  const onSelectionChangeCallback = useMemo(
    () => callback((s: NativeSelection) => onSelectionChangeRef.current?.(s)),
    [],
  );
  const onChangeCallback = useMemo(
    () => callback((e: NativeChangeEvent) => onChangeRef.current?.(e)),
    [],
  );
  const onChangeTextCallback = useMemo(
    () => callback((text: string) => onChangeTextRef.current?.(text)),
    [],
  );
  const onFocusCallback = useMemo(() => callback(() => onFocusRef.current?.()), []);
  const onBlurCallback = useMemo(() => callback(() => onBlurRef.current?.()), []);

  // Until the native view reports in, reads see an empty document, so calling the ref before onReady is safe.
  useImperativeHandle(ref, () => ({
    getText: () => native.current?.getText() ?? '',
    getTextInRange: (range) => native.current?.getTextInRange(range.start, range.end) ?? '',
    getLength: () => native.current?.getLength() ?? 0,
    getLineCount: () => native.current?.getLineCount() ?? 1,
    getLine: (index) => native.current?.getLine(index) ?? '',
    getSelection: () => {
      const s = native.current?.getSelection();
      return s ? { anchor: s.anchor, head: s.head } : { anchor: 0, head: 0 };
    },
    getRevision: () => native.current?.getRevision() ?? 0,
    offsetToPosition: (offset) =>
      native.current?.offsetToPosition(offset) ?? { line: 0, column: 0 },
    positionToOffset: (pos) => native.current?.positionToOffset(pos.line, pos.column) ?? 0,
    getCursorRect: () => native.current?.getCursorRect() ?? null,
    getVisibleLines: () => native.current?.getVisibleLines() ?? { first: 0, last: 0 },
    canUndo: () => native.current?.canUndo() ?? false,
    canRedo: () => native.current?.canRedo() ?? false,
    isFocused: () => native.current?.isFocused() ?? false,
    setText: (text, opts) =>
      native.current?.setText(text, opts?.keepHistory ?? false) ?? Promise.resolve(),
    setSelection: (sel) => native.current?.setSelection(sel.anchor, sel.head) ?? Promise.resolve(),
    selectAll: () => native.current?.selectAll() ?? Promise.resolve(),
    scrollToLine: (line, opts) =>
      native.current?.scrollToLine(line, opts?.animated ?? false) ?? Promise.resolve(),
    revealSelection: () => native.current?.revealSelection() ?? Promise.resolve(),
    replaceRange: (range, text) =>
      native.current?.replaceRange(range.start, range.end, text) ?? Promise.resolve(),
    insertText: (text) => native.current?.insertText(text) ?? Promise.resolve(),
    undo: () => native.current?.undo() ?? Promise.resolve(),
    redo: () => native.current?.redo() ?? Promise.resolve(),
    indent: () => native.current?.indent() ?? Promise.resolve(),
    outdent: () => native.current?.outdent() ?? Promise.resolve(),
    cut: () => native.current?.cut() ?? Promise.resolve(),
    copy: () => native.current?.copy() ?? Promise.resolve(),
    paste: () => native.current?.paste() ?? Promise.resolve(),
    focus: () => native.current?.focus() ?? Promise.resolve(),
    blur: () => native.current?.blur() ?? Promise.resolve(),
  }));

  return (
    <NativeCodeEditor
      {...viewProps}
      initialValue={initialValue}
      language={language}
      theme={nativeTheme}
      fontFamily={fontFamily}
      fontSize={fontSize}
      lineHeight={lineHeight}
      lineNumbers={lineNumbers}
      softWrap={softWrap}
      readOnly={readOnly}
      highlightActiveLine={highlightActiveLine}
      placeholder={placeholder}
      scrollEnabled={scrollEnabled}
      contentInsets={contentInsets}
      tabSize={tabSize}
      insertSpaces={insertSpaces}
      autoIndent={autoIndent}
      autoCloseBrackets={autoCloseBrackets}
      suggestions={suggestions}
      autoFocus={autoFocus}
      onReady={onReadyCallback}
      onScroll={onScrollCallback}
      onSelectionChange={onSelectionChangeCallback}
      onChange={onChangeCallback}
      onChangeText={onChangeText ? onChangeTextCallback : undefined}
      onEditorFocus={onFocusCallback}
      onEditorBlur={onBlurCallback}
      hybridRef={hybridRef}
    />
  );
});
