import { StyleSheet, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { KeyRow } from './KeyRow';
import { StatusLine } from './StatusLine';
import type { KeyRowProps, StatusLineProps } from './types';

type Props = KeyRowProps &
  Omit<StatusLineProps, 'bottomInset'> & {
    keyboardVisible: boolean;
    readOnly: boolean;
    bottomInset: number;
    onHeight: (height: number) => void;
  };

const OFFSET = { closed: 0, opened: 0 };

// The key row rides above the keyboard; the status line sits above the home indicator when it is closed.
export function BottomBar({ keyboardVisible, readOnly, onHeight, ...props }: Props) {
  return (
    <KeyboardStickyView offset={OFFSET} style={styles.sticky}>
      <View onLayout={(e) => onHeight(e.nativeEvent.layout.height)}>
        {keyboardVisible ? readOnly ? null : <KeyRow {...props} /> : <StatusLine {...props} />}
      </View>
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
