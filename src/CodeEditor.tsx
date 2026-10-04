import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { callback, getHostComponent } from 'react-native-nitro-modules';
import type { CodeEditorViewMethods, CodeEditorViewProps } from './specs/CodeEditorView.nitro';
import CodeEditorViewConfig from './specs/CodeEditorViewConfig';
import type { CodeEditorProps, CodeEditorRef } from './types';

const NativeCodeEditor = getHostComponent<CodeEditorViewProps, CodeEditorViewMethods>(
  'CodeEditorView',
  () => CodeEditorViewConfig,
);

type NativeRef = CodeEditorViewMethods;

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(function CodeEditor(
  { initialValue = '', onReady, ...viewProps },
  ref,
) {
  const native = useRef<NativeRef | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

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
      onReady={onReadyCallback}
      hybridRef={hybridRef}
    />
  );
});
