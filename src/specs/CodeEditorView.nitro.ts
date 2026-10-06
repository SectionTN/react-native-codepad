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

export type NativeChangeOrigin = 'input' | 'api' | 'undo' | 'redo';

export type NativeSuggestions = 'off' | 'forceOff' | 'on';

export interface NativeChangeEvent {
  start: number;
  end: number;
  text: string;
  origin: NativeChangeOrigin;
  revision: number;
}

export interface NativeSearchQuery {
  text: string;
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

// A total of 0 means no match.
export interface NativeSearchHit {
  index: number;
  total: number;
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
  matchBrackets?: boolean;
  placeholder?: string;
  scrollEnabled?: boolean;
  contentInsets?: NativeInsets;
  suggestions?: NativeSuggestions;
  autoFocus?: boolean;
  tabSize?: number;
  insertSpaces?: boolean;
  autoIndent?: boolean;
  autoCloseBrackets?: boolean;
  onReady?: () => void;
  onScroll?: (e: NativeScrollEvent) => void;
  onSelectionChange?: (s: NativeSelection) => void;
  onChange?: (e: NativeChangeEvent) => void;
  onChangeText?: (text: string) => void;
  // Not onFocus and onBlur: those names already exist on ViewProps with an event argument.
  onEditorFocus?: () => void;
  onEditorBlur?: () => void;
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
  isFocused(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  setText(text: string, keepHistory: boolean): Promise<void>;
  setSelection(anchor: number, head: number): Promise<void>;
  selectAll(): Promise<void>;
  scrollToLine(line: number, animated: boolean): Promise<void>;
  revealSelection(): Promise<void>;
  insertText(text: string): Promise<void>;
  replaceRange(start: number, end: number, text: string): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  indent(): Promise<void>;
  outdent(): Promise<void>;
  cut(): Promise<void>;
  copy(): Promise<void>;
  paste(): Promise<void>;
  focus(): Promise<void>;
  blur(): Promise<void>;
  setSearch(query: NativeSearchQuery): Promise<number>;
  findNext(): Promise<NativeSearchHit>;
  findPrevious(): Promise<NativeSearchHit>;
  replaceCurrent(text: string): Promise<boolean>;
  replaceAll(text: string): Promise<number>;
  clearSearch(): Promise<void>;
}

export type CodeEditorView = HybridView<CodeEditorViewProps, CodeEditorViewMethods>;
