import { Button, Host, HStack, Spacer, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS } from './theme';
import type { NestedBarProps } from './types';

const BAR_HEIGHT = 44;
const BUTTON_WIDTH = 44;

// The editor's floating bar again: a glass back circle on the left and the title centered over the page.
export function NestedBar({ scheme, title, topInset, onBack }: NestedBarProps) {
  const palette = IOS[scheme];
  const safe = useSafeAreaInsets();
  const background = palette.systemBackground;
  return (
    <View pointerEvents="box-none">
      <LinearGradient
        colors={[background, `${background}00`]}
        locations={[0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={{ paddingTop: topInset, paddingLeft: safe.left, paddingRight: safe.right }}
        pointerEvents="box-none"
      >
        <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
          <HStack
            alignment="center"
            spacing={0}
            modifiers={[
              frame({ maxWidth: Infinity, height: BAR_HEIGHT }),
              padding({ horizontal: 16 }),
            ]}
          >
            <Button
              label="Back"
              systemImage="chevron.left"
              onPress={onBack}
              modifiers={[
                labelStyle('iconOnly'),
                buttonStyle('glass'),
                buttonBorderShape('circle'),
                controlSize('large'),
                tint(palette.label),
                foregroundStyle(palette.label),
                accessibilityLabel('Back'),
              ]}
            />
            <Spacer />
            <Text
              modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(palette.label)]}
            >
              {title}
            </Text>
            <Spacer />
            <Spacer modifiers={[frame({ width: BUTTON_WIDTH })]} />
          </HStack>
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: 'stretch' },
});
