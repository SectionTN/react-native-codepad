import { Host, Row, Spacer, Text } from '@expo/ui';
import { StyleSheet } from 'react-native';
import type { Chrome } from '../chrome';
import { fullWidth } from '../native/layout';

type Props = {
  chrome: Chrome;
  position: string;
  language: string;
  timing: string;
  onPosition: () => void;
};

export function StatusBar({ chrome, position, language, timing, onPosition }: Props) {
  const text = { fontSize: 12, color: chrome.text };
  const muted = { fontSize: 12, color: chrome.muted };
  return (
    <Host matchContents={{ vertical: true }} style={styles.host} colorScheme={chrome.scheme}>
      <Row alignment="center" spacing={12} style={styles.row} modifiers={fullWidth}>
        <Text textStyle={text} onPress={onPosition}>
          {position}
        </Text>
        <Text textStyle={muted}>{language}</Text>
        <Text textStyle={muted}>Spaces 2</Text>
        <Spacer flexible />
        <Text textStyle={muted} numberOfLines={1}>
          {timing}
        </Text>
      </Row>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: 'stretch' },
  row: { paddingHorizontal: 12, paddingVertical: 6 },
});
