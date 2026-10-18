import {
  Column,
  Host,
  ListItem,
  ModalBottomSheet,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Slider,
  Switch,
  Text,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet } from 'react-native';
import { useAndroidColors } from './material';
import { FONT_SIZE, SUGGESTIONS, SWITCHES } from './settingsRows';
import type { SettingsSheetProps } from './types';

// A modal bottom sheet of list items: switches, segmented buttons and a slider, all Material 3.
export function SettingsSheet({ scheme, open, onClose, settings, onChange }: SettingsSheetProps) {
  const colors = useAndroidColors(scheme);
  const rowColors = { containerColor: colors.surfaceContainerLow };
  return (
    <Host style={styles.anchor} colorScheme={scheme}>
      {open ? (
        <ModalBottomSheet
          onDismissRequest={onClose}
          containerColor={colors.surfaceContainerLow}
          showDragHandle
        >
          <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 24)]}>
            <Text
              color={colors.onSurface}
              style={{ typography: 'titleLarge' }}
              modifiers={[padding(24, 8, 24, 4)]}
            >
              Settings
            </Text>
            {SWITCHES.map(([key, name]) => (
              <ListItem key={key} colors={rowColors}>
                <ListItem.HeadlineContent>
                  <Text>{name}</Text>
                </ListItem.HeadlineContent>
                <ListItem.TrailingContent>
                  <Switch
                    value={settings[key] as boolean}
                    onCheckedChange={(on) => onChange({ [key]: on })}
                  />
                </ListItem.TrailingContent>
              </ListItem>
            ))}
            <ListItem colors={rowColors}>
              <ListItem.HeadlineContent>
                <Text>Suggestions</Text>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <SingleChoiceSegmentedButtonRow>
                  {SUGGESTIONS.map(([value, name]) => (
                    <SegmentedButton
                      key={value}
                      selected={settings.suggestions === value}
                      onClick={() => onChange({ suggestions: value })}
                    >
                      <SegmentedButton.Label>
                        <Text>{name}</Text>
                      </SegmentedButton.Label>
                    </SegmentedButton>
                  ))}
                </SingleChoiceSegmentedButtonRow>
              </ListItem.TrailingContent>
            </ListItem>
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 16 }}
              modifiers={[fillMaxWidth(), padding(24, 8, 24, 0)]}
            >
              <Text color={colors.onSurface}>Font size</Text>
              <Slider
                min={FONT_SIZE.min}
                max={FONT_SIZE.max}
                steps={FONT_SIZE.max - FONT_SIZE.min - 1}
                value={settings.fontSize}
                onValueChange={(value) => onChange({ fontSize: Math.round(value) })}
                modifiers={[weight(1)]}
              />
              <Text color={colors.onSurface} style={{ typography: 'labelLarge' }}>
                {`${settings.fontSize}`}
              </Text>
            </Row>
          </Column>
        </ModalBottomSheet>
      ) : null}
    </Host>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0 },
});
