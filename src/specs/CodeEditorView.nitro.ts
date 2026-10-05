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

export interface NativeInsets {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface NativeSelection {
  anchor: number;
  head: number;
  revision: number;
}

export interface NativePosition {
  line: number;
  column: number;
}

export interface NativeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NativeVisibleLines {
  first: number;
  last: number;
}

export interface NativeScrollEvent {
  x: number;
  y: number;
  contentWidth: number;
  contentHeight: number;
}

export interface CodeEditorViewProps extends HybridViewProps {
  initialValue?: string;
  language?: string;
  theme?: NativeTheme;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  lineNumbers?: boolean;
  softWrap?: boolean;
  readOnly?: boolean;
  highlightActiveLine?: boolean;
  placeholder?: string;
  scrollEnabled?: boolean;
  contentInsets?: NativeInsets;
  onReady?: () => void;
  onScroll?: (e: NativeScrollEvent) => void;
  onSelectionChange?: (s: NativeSelection) => void;
}

export interface CodeEditorViewMethods extends HybridViewMethods {
  getText(): string;
  getLength(): number;
  getLineCount(): number;
  getLine(index: number): string;
  getRevision(): number;
  getSelection(): NativeSelection;
  getTextInRange(start: number, end: number): string;
  offsetToPosition(offset: number): NativePosition;
  positionToOffset(line: number, column: number): number;
  getCursorRect(): NativeRect | undefined;
  getVisibleLines(): NativeVisibleLines;
  setText(text: string, keepHistory: boolean): Promise<void>;
  setSelection(anchor: number, head: number): Promise<void>;
  selectAll(): Promise<void>;
  scrollToLine(line: number, animated: boolean): Promise<void>;
  revealSelection(): Promise<void>;
}

export type CodeEditorView = HybridView<CodeEditorViewProps, CodeEditorViewMethods>;
