import { useRef } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { CodeEditor, type CodeEditorRef, githubDark } from 'react-native-codepad';

const sample = [
  '// readFile with retries',
  'import { readFile } from "node:fs/promises";',
  '',
  'const MAX_RETRIES = 3;',
  '',
  'export async function load(path, retries = MAX_RETRIES) {',
  '  for (let i = 0; i < retries; i++) {',
  '    try {',
  '      return await readFile(path, "utf8");',
  '    } catch (error) {',
  '      if (i === retries - 1) throw error;',
  '    }',
  '  }',
  '  return null;',
  '}',
  '',
].join('\n');

export default function App() {
  const editor = useRef<CodeEditorRef>(null);
  return (
    <SafeAreaView style={styles.root}>
      <CodeEditor
        ref={editor}
        style={styles.editor}
        initialValue={sample}
        language="javascript"
        theme={githubDark}
        onReady={() => console.log('codepad ready, lines', editor.current?.getLineCount())}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117' },
  editor: { flex: 1 },
});
