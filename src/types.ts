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
  /** Padding inside the scrollable area in dp. Style padding on the view is ignored. */
  contentInsets?: ContentInsets;
  onReady?: () => void;
  onScroll?: (e: ScrollEvent) => void;
  onSelectionChange?: (s: SelectionChangeEvent) => void;
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
  setText(text: string, opts?: { keepHistory?: boolean }): Promise<void>;
  setSelection(sel: Selection): Promise<void>;
  selectAll(): Promise<void>;
  scrollToLine(line: number, opts?: { animated?: boolean }): Promise<void>;
  revealSelection(): Promise<void>;
}
