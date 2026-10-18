import { Host, Row, Spacer } from '@expo/ui';
import { StyleSheet, View } from 'react-native';
import type { Chrome } from '../chrome';
import { ICONS } from '../chrome/icons';
import { FilePicker } from '../native/FilePicker';
import { IconButton } from '../native/IconButton';
import { fullWidth } from '../native/layout';
import { OverflowMenu } from '../native/OverflowMenu';
import type { FileGroup, MenuChoice, MenuItem } from '../native/types';

type Props = {
  chrome: Chrome;
  topInset: number;
  groups: FileGroup[];
  fileId: string;
  onFile: (id: string) => void;
  onFind: () => void;
  items: MenuItem[];
  themes: MenuChoice[];
  theme: string;
  onTheme: (id: string) => void;
};

export function TopBar({
  chrome,
  topInset,
  groups,
  fileId,
  onFile,
  onFind,
  items,
  themes,
  theme,
  onTheme,
}: Props) {
  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: topInset,
          backgroundColor: chrome.surface,
          borderBottomColor: chrome.hairline,
        },
      ]}
    >
      <Host matchContents={{ vertical: true }} style={styles.host} colorScheme={chrome.scheme}>
        <Row alignment="center" spacing={4} style={styles.row} modifiers={fullWidth}>
          <FilePicker groups={groups} fileId={fileId} color={chrome.text} onFile={onFile} />
          <Spacer flexible />
          <IconButton icon={ICONS.search} label="Find" onPress={onFind} color={chrome.text} />
          <OverflowMenu
            icon={ICONS.more}
            label="More"
            items={items}
            themes={themes}
            theme={theme}
            onTheme={onTheme}
          />
        </Row>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  host: { alignSelf: 'stretch' },
  row: { paddingHorizontal: 8, paddingVertical: 4 },
});
