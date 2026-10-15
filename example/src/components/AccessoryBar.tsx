import { Host, Row, ScrollView } from '@expo/ui';
import type { RefObject } from 'react';
import { StyleSheet } from 'react-native';
import type { CaretDirection, CodeEditorRef } from 'react-native-codepad';
import type { Chrome } from '../chrome';
import { type AppIcon, ICONS } from '../icons';
import { Key } from '../native/Key';
import { fullWidth } from '../native/layout';

type Props = {
  chrome: Chrome;
  editor: RefObject<CodeEditorRef | null>;
  selectMode: boolean;
  onToggleSelect: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const MOVES: [string, AppIcon, CaretDirection][] = [
  ['Left', ICONS.left, 'left'],
  ['Right', ICONS.right, 'right'],
  ['Up', ICONS.up, 'up'],
  ['Down', ICONS.down, 'down'],
];

// Typed through typeText so the auto closer treats them like keystrokes.
const SYMBOLS = ['{', '}', '(', ')', '[', ']', ';', '=', '<', '>', '"', "'"];

export function AccessoryBar({
  chrome,
  editor,
  selectMode,
  onToggleSelect,
  canUndo,
  canRedo,
}: Props) {
  const api = () => editor.current;
  return (
    <Host matchContents={{ vertical: true }} style={styles.host} colorScheme={chrome.scheme}>
      <ScrollView
        direction="horizontal"
        showsIndicators={false}
        style={styles.scroll}
        modifiers={fullWidth}
      >
        <Row alignment="center" spacing={6}>
          <Key label="Select" on={selectMode} onPress={onToggleSelect} />
          {MOVES.map(([label, icon, direction]) => (
            <Key
              key={label}
              label={label}
              icon={icon}
              onPress={() => void api()?.moveCaret(direction, { select: selectMode })}
            />
          ))}
          <Key
            label="Home"
            onPress={() => void api()?.moveCaret('lineStart', { select: selectMode })}
          />
          <Key
            label="End"
            onPress={() => void api()?.moveCaret('lineEnd', { select: selectMode })}
          />
          <Key label="Tab" icon={ICONS.tab} onPress={() => void api()?.indent()} />
          <Key label="Untab" icon={ICONS.untab} onPress={() => void api()?.outdent()} />
          <Key label="Enter" icon={ICONS.enter} onPress={() => void api()?.typeText('\n')} />
          <Key label="Delete" icon={ICONS.backspace} onPress={() => void api()?.deleteBackward()} />
          {SYMBOLS.map((symbol) => (
            <Key key={symbol} label={symbol} onPress={() => void api()?.typeText(symbol)} />
          ))}
          <Key
            label="Undo"
            icon={ICONS.undo}
            disabled={!canUndo}
            onPress={() => void api()?.undo()}
          />
          <Key
            label="Redo"
            icon={ICONS.redo}
            disabled={!canRedo}
            onPress={() => void api()?.redo()}
          />
          <Key label="Hide keyboard" icon={ICONS.hideKeyboard} onPress={() => void api()?.blur()} />
        </Row>
      </ScrollView>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: 'stretch' },
  scroll: { paddingHorizontal: 8, paddingVertical: 6 },
});
