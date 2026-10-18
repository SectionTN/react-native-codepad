import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { CodeEditor, type CodeEditorRef } from 'react-native-codepad';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomBar } from './chrome/BottomBar';
import { FindBar } from './chrome/FindBar';
import { GoToLine } from './chrome/GoToLine';
import { ICONS } from './chrome/icons';
import { SettingsSheet } from './chrome/SettingsSheet';
import { TopBar } from './chrome/TopBar';
import { schemeFor } from './chrome/theme';
import type { FileGroup, MenuItem } from './chrome/types';
import { fileById, GENERATED_FILES, LANGUAGE_NAMES, SAMPLE_FILES, UNTITLED } from './files';
import { describeSelection } from './selection';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { THEMES, themeById } from './themes';

const GROUPS: FileGroup[] = [
  { title: 'Samples', files: SAMPLE_FILES.map((f) => ({ id: f.id, label: f.name })) },
  { title: 'Generated', files: GENERATED_FILES.map((f) => ({ id: f.id, label: f.name })) },
  { title: 'New', files: [{ id: UNTITLED.id, label: UNTITLED.name }] },
];

type Sheet = 'settings' | 'goToLine' | null;

type Props = { themeId: string; onTheme: (id: string) => void; onNested: () => void };

export function EditorApp({ themeId, onTheme, onNested }: Props) {
  const editor = useRef<CodeEditorRef>(null);
  const opened = useRef(0);
  const safe = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((s) => s.isVisible);

  const [fileId, setFileId] = useState(SAMPLE_FILES[0]?.id ?? UNTITLED.id);
  const [openCount, setOpenCount] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [findOpen, setFindOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [position, setPosition] = useState('Ln 1, Col 1');
  const [timing, setTiming] = useState('');
  const [barHeight, setBarHeight] = useState(0);
  const [topHeight, setTopHeight] = useState(0);
  const [lineCount, setLineCount] = useState(1);

  const file = fileById(fileId);
  const theme = themeById(themeId);
  const scheme = schemeFor(theme);
  // Loaded once per open; the generated files are built here, so the open time covers them.
  const text = useMemo(() => file.load(), [file]);
  // iOS floats its bars over the editor, so the document starts below them and scrolls under.
  const insets = useMemo(
    () => ({ top: Platform.OS === 'ios' ? topHeight : 0, bottom: barHeight }),
    [topHeight, barHeight],
  );

  const open = (id: string) => {
    opened.current = performance.now();
    setTiming(`opening ${fileById(id).name}`);
    setCanUndo(false);
    setCanRedo(false);
    setPosition('Ln 1, Col 1');
    setFileId(id);
    setOpenCount((n) => n + 1);
  };

  const onReady = () => {
    const ms = Math.round(performance.now() - opened.current);
    const lines = editor.current?.getLineCount() ?? 1;
    setLineCount(lines);
    setTiming(opened.current ? `opened in ${ms} ms` : `${lines.toLocaleString()} lines`);
  };

  const positionOf = (offset: number) => {
    const p = editor.current?.offsetToPosition(offset);
    return { line: (p?.line ?? 0) + 1, column: (p?.column ?? 0) + 1 };
  };

  // Worker time for a literal and a regex query over the open document, from the JS side.
  const timeSearch = async () => {
    const api = editor.current;
    if (!api) return;
    const t0 = performance.now();
    const literal = await api.setSearch({ text: 'e' });
    const t1 = performance.now();
    const regex = await api.setSearch({ text: 'e.*e', regex: true });
    const t2 = performance.now();
    await api.clearSearch();
    setTiming(
      `literal ${literal.count.toLocaleString()} in ${Math.round(t1 - t0)} ms, regex ${regex.count.toLocaleString()} in ${Math.round(t2 - t1)} ms`,
    );
  };

  const goToLine = async (line: number) => {
    const api = editor.current;
    if (!api) return;
    const offset = api.positionToOffset({ line: line - 1, column: 0 });
    await api.setSelection({ anchor: offset, head: offset });
    await api.scrollToLine(line - 1, { animated: true });
  };

  const onStatus = useCallback((message: string) => setTiming(message), []);
  const patchSettings = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  const items: MenuItem[] = [
    {
      id: 'undo',
      label: 'Undo',
      icon: ICONS.undo,
      disabled: !canUndo,
      onPress: () => void editor.current?.undo(),
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: ICONS.redo,
      disabled: !canRedo,
      onPress: () => void editor.current?.redo(),
    },
    {
      id: 'selectAll',
      label: 'Select all',
      icon: ICONS.selectAll,
      onPress: () => void editor.current?.selectAll(),
    },
    {
      id: 'goToLine',
      label: 'Go to line',
      icon: ICONS.goToLine,
      onPress: () => setSheet('goToLine'),
    },
    {
      id: 'timeSearch',
      label: 'Time a search',
      icon: ICONS.timer,
      onPress: () => void timeSearch(),
    },
    { id: 'nested', label: 'Nested scroll demo', icon: ICONS.nested, onPress: onNested },
    {
      id: 'settings',
      label: 'Settings',
      icon: ICONS.settings,
      onPress: () => setSheet('settings'),
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View
        style={styles.chrome}
        pointerEvents="box-none"
        onLayout={(e) => setTopHeight(e.nativeEvent.layout.height)}
      >
        <TopBar
          scheme={scheme}
          background={theme.background}
          topInset={safe.top}
          groups={GROUPS}
          fileId={fileId}
          onFile={open}
          findOpen={findOpen}
          onFind={() => setFindOpen((v) => !v)}
          items={items}
          themes={THEMES}
          themeId={themeId}
          onTheme={onTheme}
        />
        {findOpen ? (
          <FindBar
            scheme={scheme}
            editor={editor}
            onStatus={onStatus}
            onClose={() => setFindOpen(false)}
          />
        ) : null}
      </View>
      <View style={styles.body}>
        <CodeEditor
          key={`${fileId}:${openCount}`}
          ref={editor}
          style={styles.editor}
          initialValue={text}
          language={settings.highlight ? file.language : undefined}
          theme={theme}
          fontSize={settings.fontSize}
          softWrap={settings.softWrap}
          lineNumbers={settings.lineNumbers}
          highlightActiveLine={settings.activeLine}
          matchBrackets={settings.matchBrackets}
          autoCloseBrackets={settings.autoClose}
          suggestions={settings.suggestions}
          readOnly={settings.readOnly}
          placeholder="Start typing"
          avoidKeyboard
          contentInsets={insets}
          onReady={onReady}
          onChange={() => {
            setCanUndo(editor.current?.canUndo() ?? false);
            setCanRedo(editor.current?.canRedo() ?? false);
            setLineCount(editor.current?.getLineCount() ?? 1);
          }}
          onSelectionChange={(s) =>
            setPosition(describeSelection(positionOf(s.anchor), positionOf(s.head)))
          }
        />
        <BottomBar
          scheme={scheme}
          editor={editor}
          keyboardVisible={keyboardVisible}
          bottomInset={safe.bottom}
          readOnly={settings.readOnly}
          selectMode={selectMode}
          onToggleSelect={() => setSelectMode((v) => !v)}
          canUndo={canUndo}
          canRedo={canRedo}
          position={position}
          language={file.language ? (LANGUAGE_NAMES[file.language] ?? file.language) : 'Plain text'}
          timing={timing}
          onPosition={() => setSheet('goToLine')}
          onHeight={setBarHeight}
        />
      </View>
      <SettingsSheet
        scheme={scheme}
        open={sheet === 'settings'}
        onClose={() => setSheet(null)}
        settings={settings}
        onChange={patchSettings}
      />
      <GoToLine
        scheme={scheme}
        open={sheet === 'goToLine'}
        lineCount={lineCount}
        onClose={() => setSheet(null)}
        onGo={(line) => void goToLine(line)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // iOS floats the top chrome over the editor; Android stacks it above like a Material app bar.
  chrome: Platform.select({
    ios: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
    default: {},
  }) as object,
  screen: { flex: 1 },
  body: { flex: 1 },
  editor: { flex: 1 },
});
