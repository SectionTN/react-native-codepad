import { useRef } from 'react';
import { Button, View } from 'react-native';
import { CodeEditor, type CodeEditorRef } from 'react-native-codepad';

export function EditorWithToolbar() {
  const editor = useRef<CodeEditorRef>(null);
  return (
    <View style={{ flex: 1 }}>
      <Button title="Tab" onPress={() => editor.current?.typeText('  ')} />
      <Button title="Left" onPress={() => editor.current?.moveCaret('left')} />
      <Button title="Delete" onPress={() => editor.current?.deleteBackward()} />
      <CodeEditor ref={editor} style={{ flex: 1 }} />
    </View>
  );
}
