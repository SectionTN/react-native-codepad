import {
  BottomSheet,
  Button,
  Form,
  Host,
  HStack,
  NavigationStack,
  Picker,
  Section,
  Slider,
  Text,
  Toggle,
  Toolbar,
  ToolbarItem,
} from '@expo/ui/swift-ui';
import {
  font,
  monospacedDigit,
  navigationBarTitleDisplayMode,
  navigationTitle,
  pickerStyle,
  preferredColorScheme,
  presentationDetents,
  presentationDragIndicator,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';
import type { Settings } from '../settings';
import { FONT_SIZE, SUGGESTIONS, SWITCHES } from './settingsRows';
import type { SettingsSheetProps } from './types';

// A grouped form in a sheet, with the title and Done in the sheet's own navigation bar.
export function SettingsSheet({ scheme, open, onClose, settings, onChange }: SettingsSheetProps) {
  return (
    <Host style={styles.anchor} colorScheme={scheme}>
      <BottomSheet
        isPresented={open}
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
        modifiers={[
          presentationDetents(['medium', 'large']),
          presentationDragIndicator('visible'),
          preferredColorScheme(scheme),
        ]}
      >
        <NavigationStack>
          <Toolbar
            modifiers={[navigationTitle('Settings'), navigationBarTitleDisplayMode('inline')]}
          >
            <Form>
              <Section title="Editing">
                {SWITCHES.map(([key, name]) => (
                  <Toggle
                    key={key}
                    label={name}
                    isOn={settings[key] as boolean}
                    onIsOnChange={(on) => onChange({ [key]: on })}
                  />
                ))}
              </Section>
              <Section title="Suggestions">
                <Picker
                  label="Suggestions"
                  selection={settings.suggestions}
                  onSelectionChange={(value) =>
                    onChange({ suggestions: value as Settings['suggestions'] })
                  }
                  modifiers={[pickerStyle('segmented')]}
                >
                  {SUGGESTIONS.map(([value, name]) => (
                    <Text key={value} modifiers={[tag(value)]}>
                      {name}
                    </Text>
                  ))}
                </Picker>
              </Section>
              <Section title="Font size">
                <HStack alignment="center" spacing={12}>
                  <Text modifiers={[font({ size: 13 })]}>A</Text>
                  <Slider
                    min={FONT_SIZE.min}
                    max={FONT_SIZE.max}
                    step={1}
                    value={settings.fontSize}
                    onValueChange={(value) => onChange({ fontSize: Math.round(value) })}
                  />
                  <Text modifiers={[font({ size: 20 })]}>A</Text>
                  <Text modifiers={[monospacedDigit()]}>{`${settings.fontSize}`}</Text>
                </HStack>
              </Section>
            </Form>
            <Toolbar.Content>
              <ToolbarItem placement="confirmationAction">
                <Button label="Done" onPress={onClose} />
              </ToolbarItem>
            </Toolbar.Content>
          </Toolbar>
        </NavigationStack>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0 },
});
