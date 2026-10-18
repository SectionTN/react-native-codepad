import { Button, Host, Icon, LazyRow, Text } from '@expo/ui/jetpack-compose';
import { height } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KEYS } from './keys';
import { useAndroidColors } from './material';
import type { KeyRowProps } from './types';

const KEY_PADDING = { start: 14, end: 14, top: 0, bottom: 0 };

// Pill keys on a surface container band above the keyboard, Select filled while it is on.
export function KeyRow({
  scheme,
  editor,
  selectMode,
  onToggleSelect,
  canUndo,
  canRedo,
}: KeyRowProps) {
  const colors = useAndroidColors(scheme);
  const safe = useSafeAreaInsets();
  const keyColors = (on: boolean) => ({
    containerColor: on ? colors.secondaryContainer : colors.surfaceContainerHigh,
    contentColor: on ? colors.onSecondaryContainer : colors.onSurface,
  });
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.surfaceContainer,
          paddingLeft: safe.left,
          paddingRight: safe.right,
        },
      ]}
    >
      <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
        <LazyRow
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 8 }}
          contentPadding={{ start: 12, end: 12, top: 8, bottom: 8 }}
        >
          <Button
            onClick={onToggleSelect}
            colors={keyColors(selectMode)}
            contentPadding={KEY_PADDING}
            modifiers={[height(40)]}
          >
            <Text>Select</Text>
          </Button>
          {KEYS.map((key) => (
            <Button
              key={key.label}
              onClick={() => {
                const api = editor.current;
                if (api) void key.run(api, selectMode);
              }}
              enabled={!(key.disabled?.({ canUndo, canRedo }) ?? false)}
              colors={keyColors(false)}
              contentPadding={KEY_PADDING}
              modifiers={[height(40)]}
            >
              {key.icon ? (
                <Icon source={key.icon.android} size={20} contentDescription={key.label} />
              ) : (
                <Text>{key.label}</Text>
              )}
            </Button>
          ))}
        </LazyRow>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 56 },
  host: { alignSelf: 'stretch' },
});
