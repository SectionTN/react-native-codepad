import { Button, Host, HStack, Spacer, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  layoutPriority,
  lineLimit,
  monospacedDigit,
  padding,
  tint,
  truncationMode,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';
import { IOS } from './theme';
import type { StatusLineProps } from './types';

// The system bottom toolbar look: one glass capsule above the home indicator.
export function StatusLine({
  scheme,
  position,
  language,
  timing,
  onPosition,
  bottomInset,
}: StatusLineProps) {
  const palette = IOS[scheme];
  const caption = [font({ size: 12 }), foregroundStyle(palette.secondaryLabel)];
  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 8 }]}>
      <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
        <HStack
          alignment="center"
          spacing={14}
          modifiers={[
            frame({ maxWidth: Infinity, height: 44 }),
            padding({ horizontal: 16 }),
            glassEffect({ shape: 'capsule' }),
          ]}
        >
          <Button
            label={position}
            onPress={onPosition}
            modifiers={[
              buttonStyle('plain'),
              tint(palette.label),
              font({ size: 12 }),
              foregroundStyle(palette.label),
              monospacedDigit(),
              accessibilityLabel('Go to line'),
            ]}
          />
          <Text modifiers={caption}>{language}</Text>
          <Text modifiers={caption}>Spaces 2</Text>
          <Spacer />
          <Text modifiers={[...caption, lineLimit(1), truncationMode('tail'), layoutPriority(-1)]}>
            {timing}
          </Text>
        </HStack>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
  host: { alignSelf: 'stretch' },
});
