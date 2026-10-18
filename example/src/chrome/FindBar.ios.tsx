import {
  Button,
  GlassEffectContainer,
  Host,
  HStack,
  Menu,
  Text,
  TextField,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  buttonBorderShape,
  buttonStyle,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  labelStyle,
  onSubmit,
  padding,
  submitLabel,
  textInputAutocapitalization,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';
import { IOS } from './theme';
import type { FindBarProps } from './types';
import { type FindOption, useFind } from './useFind';

const FIELD_HEIGHT = 36;

const OPTIONS: { option: FindOption; label: string }[] = [
  { option: 'caseSensitive', label: 'Match Case' },
  { option: 'regex', label: 'Regular Expression' },
  { option: 'wholeWord', label: 'Whole Words' },
];

// The system find panel as the model: the options live in the field's own menu, which leaves the
// replace row its width; glass buttons around capsule fields.
export function FindBar({ scheme, editor, onStatus, onClose }: FindBarProps) {
  const palette = IOS[scheme];
  const find = useFind(editor, onStatus);
  const anyOption = OPTIONS.some(({ option }) => find.options[option]);
  const capsule = [
    frame({ maxWidth: Infinity, height: FIELD_HEIGHT }),
    padding({ horizontal: 12 }),
    glassEffect({ shape: 'capsule' }),
  ];
  const glass = [
    buttonStyle('glass'),
    buttonBorderShape('capsule'),
    tint(palette.label),
    fixedSize({ horizontal: true }),
  ];
  const arrow = [
    labelStyle('iconOnly'),
    buttonStyle('glass'),
    buttonBorderShape('circle'),
    tint(palette.label),
  ];
  const optionsColor = anyOption ? palette.label : palette.secondaryLabel;
  return (
    <View style={[styles.bar, { backgroundColor: `${palette.systemBackground}D9` }]}>
      <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
        <VStack
          spacing={8}
          modifiers={[
            frame({ maxWidth: Infinity }),
            padding({ horizontal: 16, top: 12, bottom: 8 }),
          ]}
        >
          <HStack alignment="center" spacing={8}>
            <HStack alignment="center" spacing={6} modifiers={capsule}>
              <Menu
                label="Search options"
                systemImage="magnifyingglass"
                modifiers={[
                  labelStyle('iconOnly'),
                  buttonStyle('plain'),
                  font({ size: 15 }),
                  tint(optionsColor),
                  foregroundStyle(optionsColor),
                  accessibilityLabel('Search options'),
                ]}
              >
                {OPTIONS.map(({ option, label }) => (
                  <Toggle
                    key={option}
                    label={label}
                    isOn={find.options[option]}
                    onIsOnChange={() => find.toggle(option)}
                  />
                ))}
              </Menu>
              <TextField
                placeholder="Find"
                autoFocus
                onTextChange={find.setQuery}
                modifiers={[
                  autocorrectionDisabled(true),
                  textInputAutocapitalization('never'),
                  submitLabel('search'),
                  onSubmit(() => void find.next()),
                ]}
              />
              <Text modifiers={[font({ size: 13 }), foregroundStyle(palette.secondaryLabel)]}>
                {`${find.match.index} of ${find.match.count}`}
              </Text>
            </HStack>
            <GlassEffectContainer spacing={0}>
              <HStack spacing={8}>
                <Button
                  label="Previous match"
                  systemImage="chevron.up"
                  onPress={() => void find.previous()}
                  modifiers={arrow}
                />
                <Button
                  label="Next match"
                  systemImage="chevron.down"
                  onPress={() => void find.next()}
                  modifiers={arrow}
                />
              </HStack>
            </GlassEffectContainer>
            <Button
              label="Done"
              onPress={onClose}
              modifiers={[...glass, font({ weight: 'semibold' })]}
            />
          </HStack>
          <HStack alignment="center" spacing={8}>
            <HStack alignment="center" modifiers={capsule}>
              <TextField
                placeholder="Replace"
                onTextChange={find.setReplacement}
                modifiers={[autocorrectionDisabled(true), textInputAutocapitalization('never')]}
              />
            </HStack>
            <Button label="Replace" onPress={() => void find.replaceOne()} modifiers={glass} />
            <Button label="All" onPress={() => void find.replaceAll()} modifiers={glass} />
          </HStack>
        </VStack>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {},
  host: { alignSelf: 'stretch' },
});
