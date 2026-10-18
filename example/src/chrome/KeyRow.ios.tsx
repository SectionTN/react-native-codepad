import { Button, Host, HStack, ScrollView } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  foregroundStyle,
  labelStyle,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';
import { KEYS } from './keys';
import { IOS } from './theme';
import type { KeyRowProps } from './types';

// Key caps in the keyboard's own colors, so the row reads as part of the keyboard.
export function KeyRow({
  scheme,
  editor,
  selectMode,
  onToggleSelect,
  canUndo,
  canRedo,
}: KeyRowProps) {
  const palette = IOS[scheme];
  const cap = (on: boolean) => [
    buttonStyle(on ? 'borderedProminent' : 'bordered'),
    buttonBorderShape('roundedRectangle', 8),
    controlSize('regular'),
    tint(on ? palette.label : palette.key),
    foregroundStyle(on ? palette.systemBackground : palette.keyText),
  ];
  return (
    <View style={[styles.row, { backgroundColor: palette.keyboard }]}>
      <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
        <ScrollView axes="horizontal" showsIndicators={false}>
          <HStack
            alignment="center"
            spacing={6}
            modifiers={[padding({ horizontal: 8, vertical: 6 })]}
          >
            <Button
              label="Select"
              onPress={onToggleSelect}
              modifiers={[...cap(selectMode), accessibilityLabel('Select')]}
            />
            {KEYS.map((key) => (
              <Button
                key={key.label}
                label={key.label}
                systemImage={key.icon?.ios}
                onPress={() => {
                  const api = editor.current;
                  if (api) void key.run(api, selectMode);
                }}
                modifiers={[
                  ...cap(false),
                  ...(key.icon ? [labelStyle('iconOnly')] : []),
                  disabledModifier(key.disabled?.({ canUndo, canRedo }) ?? false),
                  accessibilityLabel(key.label),
                ]}
              />
            ))}
          </HStack>
        </ScrollView>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 48 },
  host: { alignSelf: 'stretch' },
});
