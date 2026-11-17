import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CodeEditor, type CodeEditorRef, Codepad, type Decoration } from 'react-native-codepad';
import { generateJavaScript } from './bench/generate';
import { FindBar } from './chrome/FindBar';
import { schemeFor } from './chrome/theme';
import { buildDemoDecorations } from './decorations';
import { GENERATED_FILES, SAMPLE_FILES } from './files';
import { NESTED_SNIPPET } from './screens/nestedSnippet';
import { THEMES } from './themes';

type Demo = 'editor' | 'nested' | 'two';
const FILES = [...SAMPLE_FILES, ...GENERATED_FILES.filter((f) => f.id === 'js10k')];
const FONT = 'JetBrainsMono_400Regular';
const NO_DECORATIONS: { items: Decoration[]; revision: number } = { items: [], revision: -1 };

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

// The example on the web: a file picker, a theme and scrollEnabled toggle, a nested and a two editor demo.
export function EditorApp() {
  const [fileId, setFileId] = useState('python');
  const [themeIndex, setThemeIndex] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [suggestions, setSuggestions] = useState<'on' | 'off'>('off');
  const [decorate, setDecorate] = useState(false);
  const [finding, setFinding] = useState(false);
  const [status, setStatus] = useState('');
  const [decorations, setDecorations] = useState(NO_DECORATIONS);
  const editor = useRef<CodeEditorRef>(null);
  const [demo, setDemo] = useState<Demo>('editor');
  const theme = THEMES[themeIndex % THEMES.length]?.theme;
  // Lines of the generated JavaScript file the typing bench opened, 0 for a picked file.
  const [benchLines, setBenchLines] = useState(0);
  const file = FILES.find((f) => f.id === fileId) ?? FILES[0];
  // The editor and the find bar both remount when this changes, so the bar never shows a search the new editor lacks.
  const editorKey = benchLines ? `bench-${benchLines}` : file?.id;
  const text = useMemo(
    () => (benchLines ? generateJavaScript(benchLines) : (file?.load() ?? '')),
    [file, benchLines],
  );
  // Set when a file or a demo is picked, so the first paint counts from the tap.
  const started = useRef(performance.now());
  const pick = <T,>(set: (value: T) => void, value: T) => {
    started.current = performance.now();
    setBenchLines(0);
    set(value);
  };

  // The demo re-sends a fresh array four times a second, as a debounced checker would, tagged with its revision.
  useEffect(() => {
    if (!decorate) {
      setDecorations(NO_DECORATIONS);
      return;
    }
    const scheme = theme ? schemeFor(theme) : 'light';
    const send = () => {
      const ed = editor.current;
      if (ed)
        setDecorations({
          items: buildDemoDecorations(ed.getText(), scheme),
          revision: ed.getRevision(),
        });
    };
    send();
    const timer = setInterval(send, 250);
    return () => clearInterval(timer);
  }, [decorate, theme]);

  // scripts/bench-web.mjs opens its file through this hook.
  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as { __codepadBench?: { open(lines: number): void } }).__codepadBench = {
      open: (lines) => {
        started.current = performance.now();
        setDemo('editor');
        setBenchLines(lines);
      },
    };
  }, []);
  const ready = (label: string) => () =>
    console.log(
      `[example] ${label} first paint ${Math.round(performance.now() - started.current)} ms`,
    );
  const installed = Codepad.availableLanguages();

  return (
    <View style={[styles.page, { backgroundColor: theme?.background }]}>
      <View style={[styles.bar, styles.wrap]}>
        {(['editor', 'nested', 'two'] as Demo[]).map((d) => (
          <Chip key={d} label={d} on={demo === d} onPress={() => pick(setDemo, d)} />
        ))}
        <Chip
          label={THEMES[themeIndex % THEMES.length]?.label ?? ''}
          on={false}
          onPress={() => setThemeIndex((i) => i + 1)}
        />
        <Chip
          label={`scrollEnabled ${scrollEnabled}`}
          on={!scrollEnabled}
          onPress={() => setScrollEnabled((s) => !s)}
        />
        <Chip
          label={`suggestions ${suggestions}`}
          on={suggestions === 'on'}
          onPress={() => setSuggestions((s) => (s === 'on' ? 'off' : 'on'))}
        />
        <Chip label="decorations" on={decorate} onPress={() => setDecorate((d) => !d)} />
        <Chip label="find" on={finding} onPress={() => setFinding((f) => !f)} />
        {status ? <Text style={styles.chipText}>{status}</Text> : null}
      </View>
      <ScrollView horizontal style={styles.files} contentContainerStyle={styles.bar}>
        {FILES.map((f) => (
          <Chip
            key={f.id}
            label={
              installed.length === 0 || installed.includes(f.language ?? '')
                ? f.name
                : `${f.name} (none)`
            }
            on={f.id === fileId}
            onPress={() => pick(setFileId, f.id)}
          />
        ))}
      </ScrollView>
      {finding && demo === 'editor' ? (
        <FindBar
          key={editorKey}
          scheme={theme ? schemeFor(theme) : 'light'}
          editor={editor}
          onStatus={setStatus}
          onClose={() => setFinding(false)}
        />
      ) : null}
      {demo === 'editor' ? (
        <CodeEditor
          key={editorKey}
          ref={editor}
          decorations={decorations.items}
          decorationsRevision={decorations.revision}
          style={styles.editor}
          initialValue={text}
          language={benchLines ? 'javascript' : file?.language}
          theme={theme}
          fontFamily={FONT}
          scrollEnabled={scrollEnabled}
          suggestions={suggestions}
          avoidKeyboard
          onReady={ready(benchLines ? `bench ${benchLines}` : (file?.name ?? ''))}
        />
      ) : null}
      {demo === 'nested' ? (
        <ScrollView style={styles.editor}>
          <Text style={[styles.filler, { color: theme?.foreground }]}>
            The editor below sizes to its content and the page scrolls, as AlgoTN lays it out.
          </Text>
          <CodeEditor
            initialValue={NESTED_SNIPPET}
            language="javascript"
            theme={theme}
            fontFamily={FONT}
            scrollEnabled={false}
            onReady={ready('nested')}
          />
          <Text style={[styles.filler, { color: theme?.foreground }]}>End of the page.</Text>
        </ScrollView>
      ) : null}
      {demo === 'two' ? (
        <View style={[styles.editor, styles.row]}>
          <CodeEditor
            style={styles.half}
            initialValue={SAMPLE_FILES.find((f) => f.id === 'python')?.load()}
            language="python"
            theme={theme}
            fontFamily={FONT}
          />
          <CodeEditor
            style={styles.half}
            initialValue={SAMPLE_FILES.find((f) => f.id === 'javascript')?.load()}
            language="javascript"
            theme={theme}
            fontFamily={FONT}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, height: '100%' },
  bar: { flexDirection: 'row', gap: 8, padding: 8, alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  files: { flexGrow: 0 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#8884' },
  chipOn: { backgroundColor: '#0969da' },
  chipText: { fontSize: 13, color: '#888' },
  chipTextOn: { color: '#fff' },
  editor: { flex: 1 },
  row: { flexDirection: 'row' },
  half: { flex: 1 },
  filler: { padding: 16, fontSize: 15, lineHeight: 600 },
});
