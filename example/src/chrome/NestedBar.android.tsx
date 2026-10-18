import { Host, Icon, IconButton, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet, View } from 'react-native';
import { ICONS } from './icons';
import { useAndroidColors } from './material';
import type { NestedBarProps } from './types';

const BAR_HEIGHT = 64;

// The Material 3 small top app bar of the demo page: a back arrow and the title on surface.
export function NestedBar({ scheme, title, topInset, onBack }: NestedBarProps) {
  const colors = useAndroidColors(scheme);
  return (
    <View style={{ paddingTop: topInset, backgroundColor: colors.surface }}>
      <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
        <Row
          verticalAlignment="center"
          modifiers={[fillMaxWidth(), height(BAR_HEIGHT), padding(4, 0, 4, 0)]}
        >
          <IconButton onClick={onBack}>
            <Icon
              source={ICONS.back.android}
              size={24}
              tint={colors.onSurface}
              contentDescription="Back"
            />
          </IconButton>
          <Text
            color={colors.onSurface}
            style={{ typography: 'titleLarge' }}
            modifiers={[padding(4, 0, 0, 0)]}
          >
            {title}
          </Text>
          <Spacer modifiers={[weight(1)]} />
        </Row>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: 'stretch' },
});
