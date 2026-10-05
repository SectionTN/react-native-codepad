import type { ViewProps } from 'react-native';

export type TokenStyle = string | { color: string; bold?: boolean; italic?: boolean };

export interface Theme {
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
  /** Keys are tree-sitter capture names; lookup falls back along dotted prefixes. */
  tokens: Record<string, TokenStyle>;
}

export interface ContentInsets {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface Range {
  start: number;
  end: number;
}

/** head is the caret end. */
export interface Selection {
  anchor: number;
  head: number;
}

export interface Position {
  line: number;
  column: number;
}

/** View coordinates in dp. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScrollEvent {
  x: number;
  y: number;
  contentWidth: number;
  contentHeight: number;
}

export interface SelectionChangeEvent extends Selection {
  revision: number;
}

export type ChangeOrigin = 'input' | 'api' | 'undo' | 'redo';

/** [start, end) was replaced with text. */
export interface ChangeEvent {
  start: number;
  end: number;
  text: string;
  origin: ChangeOrigin;
  revision: number;
}

/** off disables keyboard suggestions, forceOff also kills composition on most keyboards, on allows autocorrect. */
export type Suggestions = 'off' | 'forceOff' | 'on';

export interface CodeEditorProps extends ViewProps {
  initialValue?: string;
  language?: string;
  theme?: Theme;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  lineNumbers?: boolean;
  softWrap?: boolean;
  readOnly?: boolean;
  highlightActiveLine?: boolean;
  placeholder?: string;
  scrollEnabled?: boolean;
  tabSize?: number;
  insertSpaces?: boolean;
  autoIndent?: boolean;
  autoCloseBrackets?: boolean;
  suggestions?: Suggestions;
  /** Focus and show the keyboard once the view is attached. */
  autoFocus?: boolean;
  /** Padding inside the scrollable area in dp. Style padding on the view is ignored. */
  contentInsets?: ContentInsets;
  onReady?: () => void;
  onScroll?: (e: ScrollEvent) => void;
  onSelectionChange?: (s: SelectionChangeEvent) => void;
  /** One event per committed change, including every keyboard composition update. */
  onChange?: (e: ChangeEvent) => void;
  /** Opt in: the full text after every change, which costs O(n) per edit. */
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface CodeEditorRef {
  getText(): string;
  getTextInRange(range: Range): string;
  getLength(): number;
  getLineCount(): number;
  getLine(index: number): string;
  getSelection(): Selection;
  getRevision(): number;
  offsetToPosition(offset: number): Position;
  positionToOffset(pos: Position): number;
  getCursorRect(): Rect | null;
  getVisibleLines(): { first: number; last: number };
  canUndo(): boolean;
  canRedo(): boolean;
  isFocused(): boolean;
  setText(text: string, opts?: { keepHistory?: boolean }): Promise<void>;
  setSelection(sel: Selection): Promise<void>;
  selectAll(): Promise<void>;
  scrollToLine(line: number, opts?: { animated?: boolean }): Promise<void>;
  revealSelection(): Promise<void>;
  replaceRange(range: Range, text: string): Promise<void>;
  insertText(text: string): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  indent(): Promise<void>;
  outdent(): Promise<void>;
  cut(): Promise<void>;
  copy(): Promise<void>;
  paste(): Promise<void>;
  focus(): Promise<void>;
  blur(): Promise<void>;
}
