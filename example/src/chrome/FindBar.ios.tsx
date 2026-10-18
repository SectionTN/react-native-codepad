import {
  Button,
  GlassEffectContainer,
  Host,
  HStack,
  Image,
  Text,
  TextField,
  VStack,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  buttonBorderShape,
  buttonStyle,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  labelStyle,
  layoutPriority,
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

// Safari's find on page as the model: a capsule field with the count inside, glass buttons around it.
export function FindBar({ scheme, editor, onStatus, onClose }: FindBarProps) {
  const palette = IOS[scheme];
  const find = useFind(editor, onStatus);
  const capsule = [
    frame({ maxWidth: Infinity, height: FIELD_HEIGHT }),
    padding({ horizontal: 12 }),
    glassEffect({ shape: 'capsule' }),
  ];
  // fixedSize keeps a label on one line when the replace row runs out of width.
  const glass = [
    buttonStyle('glass'),
    buttonBorderShape('capsule'),
    tint(palette.label),
    fixedSize({ horizontal: true }),
  ];
  const toggle = (label: string, option: FindOption, mono = false) => {
    const on = find.options[option];
    return (
      <Button
        label={label}
        onPress={() => find.toggle(option)}
        modifiers={[
          buttonStyle(on ? 'glassProminent' : 'glass'),
          buttonBorderShape('capsule'),
          tint(palette.label),
          foregroundStyle(on ? palette.systemBackground : palette.label),
          fixedSize({ horizontal: true }),
          ...(mono ? [font({ design: 'monospaced' })] : []),
        ]}
      />
    );
  };
  return (
    <View style={[styles.bar, { backgroundColor: `${palette.systemBackground}D9` }]}>
      <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
        <VStack
          spacing={8}
          modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 16, vertical: 8 })]}
        >
          <HStack alignment="center" spacing={8}>
            <HStack alignment="center" spacing={6} modifiers={capsule}>
              <Image systemName="magnifyingglass" size={15} color={palette.secondaryLabel} />
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
              <HStack spacing={0}>
                <Button
                  label="Previous match"
                  systemImage="chevron.up"
                  onPress={() => void find.previous()}
                  modifiers={[
                    labelStyle('iconOnly'),
                    buttonStyle('glass'),
                    buttonBorderShape('circle'),
                    tint(palette.label),
                  ]}
                />
                <Button
                  label="Next match"
                  systemImage="chevron.down"
                  onPress={() => void find.next()}
                  modifiers={[
                    labelStyle('iconOnly'),
                    buttonStyle('glass'),
                    buttonBorderShape('circle'),
                    tint(palette.label),
                  ]}
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
            {toggle('Aa', 'caseSensitive')}
            {toggle('.*', 'regex', true)}
            {toggle('W', 'wholeWord')}
            <HStack alignment="center" modifiers={[...capsule, layoutPriority(-1)]}>
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
