import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CodeEditor,
  type CodeEditorRef,
  githubDark,
  githubLight,
  oneDark,
  type Suggestions,
} from 'react-native-codepad';
import { SearchBar } from '../components/SearchBar';
import { LANGUAGES, type LanguageId, SAMPLES } from '../samples';

// Object props keep one identity across renders; a fresh literal would reach native on every scroll event.
const INSETS = { bottom: 24 };
const SUGGESTIONS: Suggestions[] = ['off', 'forceOff', 'on'];
const THEMES = [githubDark, githubLight, oneDark];
const THEME_NAMES = ['githubDark', 'githubLight', 'oneDark'];

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
  const [brackets, setBrackets] = useState(true);
  const [focused, setFocused] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [language, setLanguage] = useState<LanguageId>('javascript');
  const [themeIndex, setThemeIndex] = useState(0);
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
        <Toggle label="Brackets" value={brackets} onPress={() => setBrackets((v) => !v)} />
        <Toggle label="Read only" value={readOnly} onPress={() => setReadOnly((v) => !v)} />
        <Toggle
          label={`Theme ${THEME_NAMES[themeIndex]}`}
          value={false}
          onPress={() => setThemeIndex((i) => (i + 1) % THEMES.length)}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chips}
      >
        {LANGUAGES.map((id) => (
          <Toggle
            key={id}
            label={id}
            value={id === language}
            onPress={() => {
              setLanguage(id);
              setStatus(`language ${id}`);
              editor.current?.setText(SAMPLES[id]);
            }}
          />
        ))}
      </ScrollView>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.status}>{change}</Text>
      <SearchBar editor={editor} onStatus={setStatus} />
      <CodeEditor
        key={empty ? 'empty' : 'sample'}
        ref={editor}
        style={styles.editor}
        initialValue={empty ? '' : SAMPLES[language]}
        language={language}
        theme={THEMES[themeIndex]}
        softWrap={wrap}
        lineNumbers={numbers}
        highlightActiveLine={activeLine}
        placeholder="Start typing"
        scrollEnabled
        contentInsets={INSETS}
        suggestions={suggestions}
        autoCloseBrackets={autoClose}
        matchBrackets={brackets}
        readOnly={readOnly}
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
  chipRow: { flexGrow: 0 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
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
