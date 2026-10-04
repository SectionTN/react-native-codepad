import { useRef, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { CodeEditor, type CodeEditorRef, githubDark } from 'react-native-codepad';

const block = [
  '// readFile with retries',
  'import { readFile } from "node:fs/promises";',
  '',
  'const MAX_RETRIES = 3;',
  'const MESSAGE = "a long string literal that keeps going past the edge of the screen so soft wrap has something to do";',
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

const sample = new Array(40).fill(block).join('\n');

function Toggle({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, value && styles.toggleOn]}>
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const editor = useRef<CodeEditorRef>(null);
  const [wrap, setWrap] = useState(false);
  const [numbers, setNumbers] = useState(true);
  const [activeLine, setActiveLine] = useState(true);
  const [empty, setEmpty] = useState(false);
  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <Toggle label="Wrap" value={wrap} onPress={() => setWrap((v) => !v)} />
        <Toggle label="Numbers" value={numbers} onPress={() => setNumbers((v) => !v)} />
        <Toggle label="Active" value={activeLine} onPress={() => setActiveLine((v) => !v)} />
        <Toggle label="Empty" value={empty} onPress={() => setEmpty((v) => !v)} />
      </View>
      <CodeEditor
        key={empty ? 'empty' : 'sample'}
        ref={editor}
        style={styles.editor}
        initialValue={empty ? '' : sample}
        language="javascript"
        theme={githubDark}
        softWrap={wrap}
        lineNumbers={numbers}
        highlightActiveLine={activeLine}
        placeholder="Start typing"
        contentInsets={{ bottom: 24 }}
        onReady={() => console.log('codepad ready, lines', editor.current?.getLineCount())}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117', paddingTop: StatusBar.currentHeight ?? 0 },
  bar: { flexDirection: 'row', gap: 8, padding: 8 },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#21262d',
  },
  toggleOn: { backgroundColor: '#1f6feb' },
  toggleText: { color: '#e6edf3' },
  editor: { flex: 1 },
});
