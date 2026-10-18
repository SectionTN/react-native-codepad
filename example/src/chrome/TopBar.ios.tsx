import {
  Button,
  Divider,
  GlassEffectContainer,
  Host,
  HStack,
  Menu,
  Picker,
  Section,
  Spacer,
  Text,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  menuIndicator,
  padding,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS } from './theme';
import type { TopBarProps } from './types';

const BAR_HEIGHT = 44;
// Two 50 pt glass circles and the gap between them, mirrored on the left so the title stays centered.
const TRAILING_WIDTH = 108;

// Floats over the editor like an iOS 27 navigation bar: a soft edge under the status bar, glass buttons, no opaque strip.
export function TopBar({
  scheme,
  background,
  topInset,
  groups,
  fileId,
  onFile,
  findOpen,
  onFind,
  items,
  themes,
  themeId,
  onTheme,
}: TopBarProps) {
  const palette = IOS[scheme];
  const safe = useSafeAreaInsets();
  const fileName = groups.flatMap((g) => g.files).find((f) => f.id === fileId)?.label ?? '';
  const glassButton = [
    labelStyle('iconOnly'),
    buttonBorderShape('circle'),
    controlSize('large'),
    tint(palette.label),
  ];
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
            <Spacer modifiers={[frame({ width: TRAILING_WIDTH })]} />
            <Spacer />
            <Picker
              selection={fileId}
              onSelectionChange={onFile}
              label={
                <HStack alignment="center" spacing={5}>
                  <Text
                    modifiers={[
                      font({ size: 17, weight: 'semibold' }),
                      foregroundStyle(palette.label),
                    ]}
                  >
                    {fileName}
                  </Text>
                </HStack>
              }
              modifiers={[
                pickerStyle('menu'),
                menuIndicator('visible'),
                buttonStyle('plain'),
                tint(palette.secondaryLabel),
                fixedSize({ horizontal: true }),
              ]}
            >
              {groups.map((group) => (
                <Section key={group.title} title={group.title}>
                  {group.files.map((file) => (
                    <Text key={file.id} modifiers={[tag(file.id)]}>
                      {file.label}
                    </Text>
                  ))}
                </Section>
              ))}
            </Picker>
            <Spacer />
            <GlassEffectContainer spacing={0}>
              <HStack spacing={8}>
                <Button
                  label="Find"
                  systemImage="magnifyingglass"
                  onPress={onFind}
                  modifiers={[
                    ...glassButton,
                    buttonStyle(findOpen ? 'glassProminent' : 'glass'),
                    foregroundStyle(findOpen ? palette.systemBackground : palette.label),
                    accessibilityLabel('Find'),
                  ]}
                />
                <Menu
                  label="More"
                  systemImage="ellipsis.circle"
                  modifiers={[...glassButton, buttonStyle('glass'), accessibilityLabel('More')]}
                >
                  {items.map((item) => (
                    <Button
                      key={item.id}
                      label={item.label}
                      systemImage={item.icon.ios}
                      onPress={item.onPress}
                      modifiers={item.disabled ? [disabledModifier(true)] : undefined}
                    />
                  ))}
                  <Divider />
                  <Picker
                    label="Theme"
                    systemImage="paintpalette"
                    selection={themeId}
                    onSelectionChange={onTheme}
                    modifiers={[pickerStyle('menu')]}
                  >
                    {themes.map((choice) => (
                      <Text key={choice.id} modifiers={[tag(choice.id)]}>
                        {choice.label}
                      </Text>
                    ))}
                  </Picker>
                </Menu>
              </HStack>
            </GlassEffectContainer>
          </HStack>
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: 'stretch' },
});
