import type { RefObject } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CaretDirection, CodeEditorRef } from 'react-native-codepad';

type Props = {
  editor: RefObject<CodeEditorRef | null>;
  selectMode: boolean;
  onToggleSelect: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
};

const MOVES: [string, CaretDirection][] = [
  ['<-', 'left'],
  ['->', 'right'],
  ['^', 'up'],
  ['v', 'down'],
  ['Home', 'lineStart'],
  ['End', 'lineEnd'],
];

// Typed through typeText so the auto closer treats them like keystrokes.
const SYMBOLS = ['{', '}', '(', ')', '[', ']', ';', '=', '<', '>', '"', "'"];

function Key({
  label,
  on,
  disabled,
  onPress,
}: {
  label: string;
  on?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.key, on && styles.keyOn, disabled && styles.keyOff]}
    >
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );
}

export function EditorToolbar({
  editor,
  selectMode,
  onToggleSelect,
  canUndo,
  canRedo,
  onLayout,
}: Props) {
  return (
    <View style={styles.bar} onLayout={onLayout}>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.keys}
      >
        <Key label="Sel" on={selectMode} onPress={onToggleSelect} />
        {MOVES.map(([label, direction]) => (
          <Key
            key={label}
            label={label}
            onPress={() => void editor.current?.moveCaret(direction, { select: selectMode })}
          />
        ))}
        <Key label="Tab" onPress={() => void editor.current?.indent()} />
        <Key label="Untab" onPress={() => void editor.current?.outdent()} />
        <Key label="Enter" onPress={() => void editor.current?.typeText('\n')} />
        <Key label="Del" onPress={() => void editor.current?.deleteBackward()} />
        {SYMBOLS.map((symbol) => (
          <Key key={symbol} label={symbol} onPress={() => void editor.current?.typeText(symbol)} />
        ))}
        <Key label="Undo" disabled={!canUndo} onPress={() => void editor.current?.undo()} />
        <Key label="Redo" disabled={!canRedo} onPress={() => void editor.current?.redo()} />
        <Key label="Hide" onPress={() => void editor.current?.blur()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#161b22',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#30363d',
    paddingVertical: 6,
  },
  keys: { flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  key: {
    minWidth: 40,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#21262d',
  },
  keyOn: { backgroundColor: '#1f6feb' },
  keyOff: { opacity: 0.4 },
  keyText: { color: '#e6edf3', fontSize: 15 },
});
