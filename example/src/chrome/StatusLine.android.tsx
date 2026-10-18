import { Host, Row, Spacer, Text, TextButton } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet, View } from 'react-native';
import { useAndroidColors } from './material';
import type { StatusLineProps } from './types';

const NO_PADDING = { start: 0, end: 0, top: 0, bottom: 0 };

// A surface container strip; the navigation inset below takes the same color.
export function StatusLine({
  scheme,
  position,
  language,
  timing,
  onPosition,
  bottomInset,
}: StatusLineProps) {
  const colors = useAndroidColors(scheme);
  return (
    <View style={{ backgroundColor: colors.surfaceContainer, paddingBottom: bottomInset }}>
      <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxWidth(), height(36), padding(16, 0, 16, 0)]}
        >
          <TextButton onClick={onPosition} contentPadding={NO_PADDING}>
            <Text color={colors.onSurface} style={{ typography: 'labelMedium' }}>
              {position}
            </Text>
          </TextButton>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'labelMedium' }}>
            {language}
          </Text>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'labelMedium' }}>
            Spaces 2
          </Text>
          <Spacer modifiers={[weight(1)]} />
          <Text color={colors.onSurfaceVariant} style={{ typography: 'labelMedium' }}>
            {timing}
          </Text>
        </Row>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: 'stretch' },
});
