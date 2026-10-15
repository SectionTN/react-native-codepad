import type { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CodeEditorRef } from 'react-native-codepad';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import type { Chrome } from '../chrome';
import { AccessoryBar } from './AccessoryBar';
import { StatusBar } from './StatusBar';

type Props = {
  chrome: Chrome;
  editor: RefObject<CodeEditorRef | null>;
  keyboardVisible: boolean;
  bottomInset: number;
  readOnly: boolean;
  selectMode: boolean;
  onToggleSelect: () => void;
  canUndo: boolean;
  canRedo: boolean;
  position: string;
  language: string;
  timing: string;
  onPosition: () => void;
  onHeight: (height: number) => void;
};

const OFFSET = { closed: 0, opened: 0 };

// Sits above the keyboard while it is up and above the home indicator while it is closed.
export function BottomBar({
  chrome,
  editor,
  keyboardVisible,
  bottomInset,
  readOnly,
  selectMode,
  onToggleSelect,
  canUndo,
  canRedo,
  position,
  language,
  timing,
  onPosition,
  onHeight,
}: Props) {
  return (
    <KeyboardStickyView offset={OFFSET} style={styles.sticky}>
      <View
        onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
        style={[
          styles.bar,
          {
            backgroundColor: chrome.surface,
            borderTopColor: chrome.hairline,
            paddingBottom: keyboardVisible ? 0 : bottomInset,
          },
        ]}
      >
        {keyboardVisible && !readOnly ? (
          <AccessoryBar
            chrome={chrome}
            editor={editor}
            selectMode={selectMode}
            onToggleSelect={onToggleSelect}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        ) : null}
        <StatusBar
          chrome={chrome}
          position={position}
          language={language}
          timing={timing}
          onPosition={onPosition}
        />
      </View>
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
});
