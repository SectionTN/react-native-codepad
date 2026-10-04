import type { HybridView, HybridViewMethods, HybridViewProps } from 'react-native-nitro-modules';

export interface NativeTokenStyle {
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface NativeTheme {
  background: string;
  foreground: string;
  gutterBackground: string;
  gutterForeground: string;
  gutterActiveForeground: string;
  activeLine: string;
  selection: string;
  cursor: string;
  matchingBracket: string;
  searchMatch: string;
  searchMatchActive: string;
  tokens: Record<string, NativeTokenStyle>;
}

export interface CodeEditorViewProps extends HybridViewProps {
  initialValue?: string;
  language?: string;
  theme?: NativeTheme;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
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
