import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type { ViewProps } from 'react-native';
import { callback, getHostComponent } from 'react-native-nitro-modules';
import type { CodeEditorViewMethods, CodeEditorViewProps } from './specs/CodeEditorView.nitro';
import CodeEditorViewConfig from './specs/CodeEditorViewConfig';

const NativeCodeEditor = getHostComponent<CodeEditorViewProps, CodeEditorViewMethods>(
  'CodeEditorView',
  () => CodeEditorViewConfig,
);

type NativeRef = CodeEditorViewMethods;

export interface CodeEditorProps extends ViewProps {
  initialValue?: string;
  onReady?: () => void;
}

export interface CodeEditorRef {
  getText(): string;
}

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

  useImperativeHandle(ref, () => ({
    getText: () => native.current?.getText() ?? '',
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
