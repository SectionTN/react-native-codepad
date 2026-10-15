import { CodeEditor } from 'react-native-codepad';
import { typescript } from 'react-native-codepad-lang-typescript';

const source = 'export function greet(name: string) {\n  return "hi " + name;\n}\n';

export function HighlightedEditor() {
  return <CodeEditor language={typescript} initialValue={source} lineNumbers style={{ flex: 1 }} />;
}
