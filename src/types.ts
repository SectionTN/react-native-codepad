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
  /** Padding inside the scrollable area in dp. Style padding on the view is ignored. */
  contentInsets?: ContentInsets;
  onReady?: () => void;
}

export interface CodeEditorRef {
  getText(): string;
  getLength(): number;
  getLineCount(): number;
  getLine(index: number): string;
  getRevision(): number;
  setText(text: string, opts?: { keepHistory?: boolean }): Promise<void>;
}
