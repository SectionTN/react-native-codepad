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

/** View size in dp at which nothing scrolls, contentInsets included. */
export interface ContentSizeEvent {
  width: number;
  height: number;
}

export type CaretDirection =
  | 'left'
  | 'right'
  | 'wordLeft'
  | 'wordRight'
  | 'lineStart'
  | 'lineEnd'
  | 'documentStart'
  | 'documentEnd'
  | 'up'
  | 'down'
  | 'pageUp'
  | 'pageDown';

/** off disables keyboard suggestions, forceOff also kills composition on most keyboards, on allows autocorrect. */
export type Suggestions = 'off' | 'forceOff' | 'on';

export interface SearchQuery {
  text: string;
  /** Treat text as a Java regex. Replacement text is always literal. */
  regex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export interface SearchHit {
  index: number;
  total: number;
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
  /** Paint the bracket pair at the caret, skipping brackets inside strings and comments. */
  matchBrackets?: boolean;
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
  /** Inset the content by the keyboard's overlap with the view, following the keyboard animation. Android only until the iOS editor lands. */
  avoidKeyboard?: boolean;
  onReady?: () => void;
  onScroll?: (e: ScrollEvent) => void;
  onSelectionChange?: (s: SelectionChangeEvent) => void;
  /** One event per committed change, including every keyboard composition update. */
  onChange?: (e: ChangeEvent) => void;
  /** Opt in: the full text after every change, which costs O(n) per edit. */
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Fires after a draw whose content size changed, at most once per frame; the first one precedes onReady. */
  onContentSizeChange?: (e: ContentSizeEvent) => void;
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
  /** Rejects when a regex query does not compile. */
  setSearch(query: SearchQuery): Promise<{ count: number }>;
  findNext(): Promise<SearchHit | null>;
  findPrevious(): Promise<SearchHit | null>;
  /** Replaces the selected match and selects the next one; false when the selection is not a match. */
  replaceCurrent(text: string): Promise<boolean>;
  /** One undo group; resolves with the number of replacements. */
  replaceAll(text: string): Promise<number>;
  clearSearch(): Promise<void>;
  /** Moves the caret like the matching hardware key; select extends the selection. Works under readOnly. */
  moveCaret(direction: CaretDirection, opts?: { select?: boolean }): Promise<void>;
  /** As typed on the keyboard: auto close, indentation on a newline, origin input; a no-op when readOnly. */
  typeText(text: string): Promise<void>;
  /** Backspace: an empty auto closed pair goes in one go; a no-op when readOnly. */
  deleteBackward(): Promise<void>;
  /** Delete; a no-op when readOnly. */
  deleteForward(): Promise<void>;
}
