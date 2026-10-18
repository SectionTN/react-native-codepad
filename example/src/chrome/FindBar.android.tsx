import {
  Column,
  FilterChip,
  Host,
  Icon,
  IconButton,
  OutlinedTextField,
  Row,
  Text,
  TextButton,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICONS } from './icons';
import { useAndroidColors } from './material';
import type { FindBarProps } from './types';
import { type FindOption, useFind } from './useFind';

// Outlined fields, filter chips for the options and text buttons for the actions, all Material 3.
export function FindBar({ scheme, editor, onStatus, onClose }: FindBarProps) {
  const colors = useAndroidColors(scheme);
  const safe = useSafeAreaInsets();
  const find = useFind(editor, onStatus);
  const query = useNativeState('');
  const replacement = useNativeState('');
  const chip = (label: string, option: FindOption) => (
    <FilterChip selected={find.options[option]} onClick={() => find.toggle(option)}>
      {find.options[option] ? (
        <FilterChip.LeadingIcon>
          <Icon source={ICONS.check.android} size={18} />
        </FilterChip.LeadingIcon>
      ) : null}
      <FilterChip.Label>
        <Text>{label}</Text>
      </FilterChip.Label>
    </FilterChip>
  );
  return (
    <View
      style={{ backgroundColor: colors.surface, paddingLeft: safe.left, paddingRight: safe.right }}
    >
      <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
        <Column
          verticalArrangement={{ spacedBy: 8 }}
          modifiers={[fillMaxWidth(), padding(12, 4, 12, 12)]}
        >
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
            <OutlinedTextField
              value={query}
              onValueChange={find.setQuery}
              autoFocus
              modifiers={[weight(1)]}
            >
              <OutlinedTextField.Label>
                <Text>Find</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>
            <Text color={colors.onSurfaceVariant} style={{ typography: 'labelMedium' }}>
              {`${find.match.index} of ${find.match.count}`}
            </Text>
            <IconButton onClick={() => void find.previous()}>
              <Icon
                source={ICONS.previous.android}
                size={24}
                tint={colors.onSurfaceVariant}
                contentDescription="Previous match"
              />
            </IconButton>
            <IconButton onClick={() => void find.next()}>
              <Icon
                source={ICONS.next.android}
                size={24}
                tint={colors.onSurfaceVariant}
                contentDescription="Next match"
              />
            </IconButton>
          </Row>
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
            {chip('Aa', 'caseSensitive')}
            {chip('.*', 'regex')}
            {chip('W', 'wholeWord')}
            <OutlinedTextField
              value={replacement}
              onValueChange={find.setReplacement}
              modifiers={[weight(1)]}
            >
              <OutlinedTextField.Label>
                <Text>Replace</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>
          </Row>
          <Row
            verticalAlignment="center"
            horizontalArrangement="end"
            modifiers={[fillMaxWidth(), height(40)]}
          >
            <TextButton onClick={() => void find.replaceOne()}>
              <Text>Replace</Text>
            </TextButton>
            <TextButton onClick={() => void find.replaceAll()}>
              <Text>Replace all</Text>
            </TextButton>
            <TextButton onClick={onClose}>
              <Text>Done</Text>
            </TextButton>
          </Row>
        </Column>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: 'stretch' },
});
