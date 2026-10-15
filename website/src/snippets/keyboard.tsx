import { CodeEditor } from 'react-native-codepad';

export function KeyboardAwareEditor() {
  return (
    <CodeEditor
      avoidKeyboard
      autoFocus
      suggestions="off"
      contentInsets={{ bottom: 56 }}
      style={{ flex: 1 }}
    />
  );
}
