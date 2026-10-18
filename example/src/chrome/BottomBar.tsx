import { StyleSheet, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { KeyRow } from './KeyRow';
import { StatusLine } from './StatusLine';
import type { KeyRowProps, StatusLineProps } from './types';

type Props = KeyRowProps &
  Omit<StatusLineProps, 'bottomInset'> & {
    keyboardVisible: boolean;
    editorFocused: boolean;
    readOnly: boolean;
    bottomInset: number;
    onHeight: (height: number) => void;
  };

const OFFSET = { closed: 0, opened: 0 };

// The key row rides above the keyboard while the editor owns it; another field's keyboard gets neither bar.
export function BottomBar({ keyboardVisible, editorFocused, readOnly, onHeight, ...props }: Props) {
  const keys = keyboardVisible && editorFocused && !readOnly;
  return (
    <KeyboardStickyView offset={OFFSET} style={styles.sticky}>
      <View onLayout={(e) => onHeight(e.nativeEvent.layout.height)}>
        {keys ? <KeyRow {...props} /> : keyboardVisible ? null : <StatusLine {...props} />}
      </View>
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
