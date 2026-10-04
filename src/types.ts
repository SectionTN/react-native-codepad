import type { ViewProps } from 'react-native';

export interface CodeEditorProps extends ViewProps {
  initialValue?: string;
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
