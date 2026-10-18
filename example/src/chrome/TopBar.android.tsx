import {
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Host,
  Icon,
  IconButton,
  Row,
  Spacer,
  Text,
  TextButton,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { Fragment, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICONS } from './icons';
import { useAndroidColors } from './material';
import type { TopBarProps } from './types';

const BAR_HEIGHT = 64;

// A Material 3 top app bar composed by hand: Expo UI ships no app bar, so a Row on surface does the job.
export function TopBar({
  scheme,
  topInset,
  groups,
  fileId,
  onFile,
  onFind,
  items,
  themes,
  themeId,
  onTheme,
}: TopBarProps) {
  const colors = useAndroidColors(scheme);
  const safe = useSafeAreaInsets();
  const [filesOpen, setFilesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [themeList, setThemeList] = useState(false);
  const fileName = groups.flatMap((g) => g.files).find((f) => f.id === fileId)?.label ?? '';
  const closeMore = () => {
    setMoreOpen(false);
    setThemeList(false);
  };
  return (
    <View
      style={{
        paddingTop: topInset,
        paddingLeft: safe.left,
        paddingRight: safe.right,
        backgroundColor: colors.surface,
      }}
    >
      <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
        <Row
          verticalAlignment="center"
          modifiers={[fillMaxWidth(), height(BAR_HEIGHT), padding(8, 0, 4, 0)]}
        >
          <DropdownMenu expanded={filesOpen} onDismissRequest={() => setFilesOpen(false)}>
            <DropdownMenu.Trigger>
              <TextButton onClick={() => setFilesOpen(true)}>
                <Text color={colors.onSurface} style={{ typography: 'titleLarge' }}>
                  {fileName}
                </Text>
                <Icon source={ICONS.dropdown.android} size={24} tint={colors.onSurfaceVariant} />
              </TextButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Items>
              {groups.map((group, index) => (
                <Fragment key={group.title}>
                  {index > 0 ? <HorizontalDivider /> : null}
                  <Text
                    color={colors.onSurfaceVariant}
                    style={{ typography: 'labelSmall' }}
                    modifiers={[padding(16, 10, 16, 4)]}
                  >
                    {group.title}
                  </Text>
                  {group.files.map((file) => (
                    <DropdownMenuItem
                      key={file.id}
                      onClick={() => {
                        setFilesOpen(false);
                        onFile(file.id);
                      }}
                    >
                      <DropdownMenuItem.Text>
                        <Text>{file.label}</Text>
                      </DropdownMenuItem.Text>
                      {file.id === fileId ? (
                        <DropdownMenuItem.TrailingIcon>
                          <Icon source={ICONS.check.android} size={20} />
                        </DropdownMenuItem.TrailingIcon>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </Fragment>
              ))}
            </DropdownMenu.Items>
          </DropdownMenu>
          <Spacer modifiers={[weight(1)]} />
          <IconButton onClick={onFind}>
            <Icon
              source={ICONS.search.android}
              size={24}
              tint={colors.onSurfaceVariant}
              contentDescription="Find"
            />
          </IconButton>
          <DropdownMenu expanded={moreOpen} onDismissRequest={closeMore}>
            <DropdownMenu.Trigger>
              <IconButton onClick={() => setMoreOpen(true)}>
                <Icon
                  source={ICONS.more.android}
                  size={24}
                  tint={colors.onSurfaceVariant}
                  contentDescription="More"
                />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Items>
              {themeList
                ? themes.map((choice) => (
                    <DropdownMenuItem
                      key={choice.id}
                      onClick={() => {
                        closeMore();
                        onTheme(choice.id);
                      }}
                    >
                      <DropdownMenuItem.Text>
                        <Text>{choice.label}</Text>
                      </DropdownMenuItem.Text>
                      {choice.id === themeId ? (
                        <DropdownMenuItem.TrailingIcon>
                          <Icon source={ICONS.check.android} size={20} />
                        </DropdownMenuItem.TrailingIcon>
                      ) : null}
                    </DropdownMenuItem>
                  ))
                : [
                    ...items.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        enabled={!item.disabled}
                        onClick={() => {
                          closeMore();
                          item.onPress();
                        }}
                      >
                        <DropdownMenuItem.LeadingIcon>
                          <Icon source={item.icon.android} size={24} />
                        </DropdownMenuItem.LeadingIcon>
                        <DropdownMenuItem.Text>
                          <Text>{item.label}</Text>
                        </DropdownMenuItem.Text>
                      </DropdownMenuItem>
                    )),
                    <HorizontalDivider key="divider" />,
                    <DropdownMenuItem key="theme" onClick={() => setThemeList(true)}>
                      <DropdownMenuItem.LeadingIcon>
                        <Icon source={ICONS.theme.android} size={24} />
                      </DropdownMenuItem.LeadingIcon>
                      <DropdownMenuItem.Text>
                        <Text>Theme</Text>
                      </DropdownMenuItem.Text>
                      <DropdownMenuItem.TrailingIcon>
                        <Icon source={ICONS.chevronRight.android} size={20} />
                      </DropdownMenuItem.TrailingIcon>
                    </DropdownMenuItem>,
                  ]}
            </DropdownMenu.Items>
          </DropdownMenu>
        </Row>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: 'stretch' },
});
