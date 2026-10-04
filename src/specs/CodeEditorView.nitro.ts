import type { HybridView, HybridViewMethods, HybridViewProps } from 'react-native-nitro-modules';

export interface CodeEditorViewProps extends HybridViewProps {
  initialValue?: string;
  onReady?: () => void;
}

export interface CodeEditorViewMethods extends HybridViewMethods {
  getText(): string;
}

export type CodeEditorView = HybridView<CodeEditorViewProps, CodeEditorViewMethods>;
