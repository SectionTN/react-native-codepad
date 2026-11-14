import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CodeEditor, Codepad } from 'react-native-codepad';
import { GENERATED_FILES, SAMPLE_FILES } from './files';
import { NESTED_SNIPPET } from './screens/nestedSnippet';
import { THEMES } from './themes';

type Demo = 'editor' | 'nested' | 'two';
const FILES = [...SAMPLE_FILES, ...GENERATED_FILES.filter((f) => f.id === 'js10k')];
const FONT = 'JetBrainsMono_400Regular';

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
  const [demo, setDemo] = useState<Demo>('editor');
  const theme = THEMES[themeIndex % THEMES.length]?.theme;
  const file = FILES.find((f) => f.id === fileId) ?? FILES[0];
  const text = useMemo(() => file?.load() ?? '', [file]);
  // Set when a file or a demo is picked, so the first paint counts from the tap.
  const started = useRef(performance.now());
  const pick = <T,>(set: (value: T) => void, value: T) => {
    started.current = performance.now();
    set(value);
  };
  const ready = (label: string) => () =>
    console.log(
      `[example] ${label} first paint ${Math.round(performance.now() - started.current)} ms`,
    );
  const installed = Codepad.availableLanguages();

  return (
    <View style={[styles.page, { backgroundColor: theme?.background }]}>
      <View style={styles.bar}>
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
      {demo === 'editor' ? (
        <CodeEditor
          key={file?.id}
          style={styles.editor}
          initialValue={text}
          language={file?.language}
          theme={theme}
          fontFamily={FONT}
          scrollEnabled={scrollEnabled}
          onReady={ready(file?.name ?? '')}
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
