import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CodeEditor, type CodeEditorRef, githubDark } from 'react-native-codepad';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorToolbar } from '../components/EditorToolbar';
import { sample } from '../sample';

export function ToolbarScreen() {
  const editor = useRef<CodeEditorRef>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [position, setPosition] = useState('line 1, col 1');
  const keyboardHeight = useKeyboardState((s) => s.height);
  const safe = useSafeAreaInsets();
  // The toolbar rides the keyboard and rests above the navigation bar while the keyboard is closed.
  const lift = keyboardHeight > 0 ? keyboardHeight : safe.bottom;
  const insets = useMemo(() => ({ bottom: toolbarHeight + lift }), [toolbarHeight, lift]);
  const offset = useMemo(() => ({ closed: -safe.bottom, opened: 0 }), [safe.bottom]);
  return (
    <View style={styles.screen}>
      <Text style={styles.status}>{position}</Text>
      <CodeEditor
        ref={editor}
        style={styles.editor}
        initialValue={sample}
        language="javascript"
        theme={githubDark}
        contentInsets={insets}
        onSelectionChange={(s) => {
          const at = (offset: number) => {
            const p = editor.current?.offsetToPosition(offset);
            return `line ${(p?.line ?? 0) + 1}, col ${(p?.column ?? 0) + 1}`;
          };
          setPosition(s.anchor === s.head ? at(s.head) : `${at(s.anchor)} to ${at(s.head)}`);
        }}
        onChange={() => {
          setCanUndo(editor.current?.canUndo() ?? false);
          setCanRedo(editor.current?.canRedo() ?? false);
        }}
      />
      <KeyboardStickyView offset={offset} style={styles.sticky}>
        <EditorToolbar
          editor={editor}
          selectMode={selectMode}
          onToggleSelect={() => setSelectMode((v) => !v)}
          canUndo={canUndo}
          canRedo={canRedo}
          onLayout={(e) => setToolbarHeight(e.nativeEvent.layout.height)}
        />
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  status: { color: '#8b949e', paddingHorizontal: 8, paddingVertical: 4, fontSize: 12 },
  editor: { flex: 1 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
