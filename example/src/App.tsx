import { useRef } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { CodeEditor, type CodeEditorRef } from 'react-native-codepad';

const sample = ['function greet(name) {', '  return "hi " + name;', '}', ''].join('\n');

export default function App() {
  const editor = useRef<CodeEditorRef>(null);
  return (
    <SafeAreaView style={styles.root}>
      <CodeEditor
        ref={editor}
        style={styles.editor}
        initialValue={sample}
        onReady={() =>
          console.log(
            'codepad ready, lines',
            editor.current?.getLineCount(),
            'revision',
            editor.current?.getRevision(),
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  editor: { flex: 1 },
});
