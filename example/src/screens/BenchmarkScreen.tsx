import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CodeEditor, type CodeEditorRef, githubDark } from 'react-native-codepad';
import { generateJavaScript } from '../bench/generate';

type Doc = { key: number; lines: number; text: string };

function Button({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.button, active && styles.buttonOn]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function BenchmarkScreen() {
  const editor = useRef<CodeEditorRef>(null);
  const started = useRef(0);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [highlight, setHighlight] = useState(true);
  const [status, setStatus] = useState('Pick a size');

  const open = (lines: number) => {
    const text = generateJavaScript(lines);
    setStatus(`opening ${lines} lines, ${text.length} chars`);
    started.current = Date.now();
    setDoc({ key: Date.now(), lines, text });
  };

  // Fires after the first draw with the text applied, so this is the open to paint time.
  const onReady = () => {
    const ms = Date.now() - started.current;
    const message = `${doc?.lines ?? 0} lines, first paint ${ms} ms, native ${editor.current?.getLineCount()} lines`;
    setStatus(message);
    console.log('codepad bench', message);
  };

  // Worker time for a literal and a regex query over the open document, from the JS side.
  const search = async () => {
    const api = editor.current;
    if (!api) return;
    const t0 = performance.now();
    const literal = await api.setSearch({ text: 'e' });
    const t1 = performance.now();
    const regex = await api.setSearch({ text: 'e.*e', regex: true });
    const t2 = performance.now();
    const message = `literal ${literal.count} in ${Math.round(t1 - t0)} ms, regex ${regex.count} in ${Math.round(t2 - t1)} ms`;
    setStatus(message);
    console.log('codepad bench', message);
    await api.clearSearch();
  };

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <Button label="10k" onPress={() => open(10_000)} />
        <Button label="100k" onPress={() => open(100_000)} />
        <Button label="Clear" onPress={() => setDoc(null)} />
        <Button label="Highlight" active={highlight} onPress={() => setHighlight((v) => !v)} />
        <Button label="Search" onPress={() => void search()} />
      </View>
      <Text style={styles.status}>{status}</Text>
      {doc ? (
        <CodeEditor
          key={doc.key}
          ref={editor}
          style={styles.editor}
          initialValue={doc.text}
          language={highlight ? 'javascript' : undefined}
          theme={githubDark}
          onReady={onReady}
        />
      ) : (
        <View style={styles.editor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', gap: 8, padding: 8 },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#21262d',
  },
  buttonOn: { backgroundColor: '#1f6feb' },
  buttonText: { color: '#e6edf3' },
  status: { color: '#8b949e', paddingHorizontal: 8, paddingBottom: 4, fontSize: 12 },
  editor: { flex: 1 },
});
