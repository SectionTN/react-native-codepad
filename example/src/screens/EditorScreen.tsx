import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CodeEditor, type CodeEditorRef, githubDark, type Suggestions } from 'react-native-codepad';

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

const SUGGESTIONS: Suggestions[] = ['off', 'forceOff', 'on'];

function Toggle({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, value && styles.toggleOn]}>
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
}

export function EditorScreen() {
  const editor = useRef<CodeEditorRef>(null);
  const [wrap, setWrap] = useState(false);
  const [numbers, setNumbers] = useState(true);
  const [activeLine, setActiveLine] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [status, setStatus] = useState('tap, scroll or select');
  const [change, setChange] = useState('no edits yet');
  const [suggestions, setSuggestions] = useState<Suggestions>('off');
  const [autoClose, setAutoClose] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Toggle label="Wrap" value={wrap} onPress={() => setWrap((v) => !v)} />
        <Toggle label="Numbers" value={numbers} onPress={() => setNumbers((v) => !v)} />
        <Toggle label="Active" value={activeLine} onPress={() => setActiveLine((v) => !v)} />
        <Toggle label="Empty" value={empty} onPress={() => setEmpty((v) => !v)} />
        <Toggle
          label="Top"
          value={false}
          onPress={() => editor.current?.scrollToLine(0, { animated: true })}
        />
        <Toggle label="Line 300" value={false} onPress={() => editor.current?.scrollToLine(300)} />
        <Toggle label="Undo" value={false} onPress={() => editor.current?.undo()} />
        <Toggle label="Redo" value={false} onPress={() => editor.current?.redo()} />
        <Toggle
          label={focused ? 'Blur' : 'Focus'}
          value={focused}
          onPress={() => (focused ? editor.current?.blur() : editor.current?.focus())}
        />
        <Toggle
          label={`Sugg ${suggestions}`}
          value={suggestions !== 'off'}
          onPress={() =>
            setSuggestions(
              (s) => SUGGESTIONS[(SUGGESTIONS.indexOf(s) + 1) % SUGGESTIONS.length] ?? 'off',
            )
          }
        />
        <Toggle label="Auto" value={autoClose} onPress={() => setAutoClose((v) => !v)} />
      </View>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.status}>{change}</Text>
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
        scrollEnabled
        contentInsets={{ bottom: 24 }}
        suggestions={suggestions}
        autoCloseBrackets={autoClose}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) =>
          setChange(
            `rev ${e.revision}: -${e.end - e.start} +${e.text.length} at ${e.start} (${e.origin})`,
          )
        }
        onReady={() => console.log('codepad ready, lines', editor.current?.getLineCount())}
        onScroll={(e) => {
          const lines = editor.current?.getVisibleLines();
          setStatus(
            `scroll ${Math.round(e.y)} of ${Math.round(e.contentHeight)} dp, lines ${(lines?.first ?? 0) + 1} to ${(lines?.last ?? 0) + 1}`,
          );
        }}
        onSelectionChange={(s) => {
          const rect = editor.current?.getCursorRect();
          setStatus(
            `selection ${s.anchor}..${s.head} rev ${s.revision}, caret ${rect ? `${Math.round(rect.x)},${Math.round(rect.y)}` : 'none'}`,
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 },
  status: { color: '#8b949e', paddingHorizontal: 8, paddingBottom: 4, fontSize: 12 },
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
