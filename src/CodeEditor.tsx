import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { callback, getHostComponent } from 'react-native-nitro-modules';
import type {
  CodeEditorViewMethods,
  CodeEditorViewProps,
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
    onReady,
    ...viewProps
  },
  ref,
) {
  const native = useRef<NativeRef | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
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

  // Until the native view reports in, reads see an empty document, so calling the ref before onReady is safe.
  useImperativeHandle(ref, () => ({
    getText: () => native.current?.getText() ?? '',
    getLength: () => native.current?.getLength() ?? 0,
    getLineCount: () => native.current?.getLineCount() ?? 1,
    getLine: (index) => native.current?.getLine(index) ?? '',
    getRevision: () => native.current?.getRevision() ?? 0,
    setText: (text, opts) =>
      native.current?.setText(text, opts?.keepHistory ?? false) ?? Promise.resolve(),
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
      onReady={onReadyCallback}
      hybridRef={hybridRef}
    />
  );
});
