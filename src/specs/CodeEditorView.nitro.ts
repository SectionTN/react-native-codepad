import type { HybridView, HybridViewMethods, HybridViewProps } from 'react-native-nitro-modules';

export interface CodeEditorViewProps extends HybridViewProps {
  initialValue?: string;
  onReady?: () => void;
}

export interface CodeEditorViewMethods extends HybridViewMethods {
  getText(): string;
  getLength(): number;
  getLineCount(): number;
  getLine(index: number): string;
  getRevision(): number;
  setText(text: string, keepHistory: boolean): Promise<void>;
}

export type CodeEditorView = HybridView<CodeEditorViewProps, CodeEditorViewMethods>;
