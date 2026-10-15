import { CodeEditor } from 'react-native-codepad';
import { typescript } from 'react-native-codepad-lang-typescript';

const source = `export function greet(name: string) {
  return "hi " + name;
}
`;

export function HighlightedEditor() {
  return (
    <CodeEditor
      language={typescript}
      initialValue={source}
      lineNumbers
      style={{ flex: 1 }}
    />
  );
}
