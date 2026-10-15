import { Host, Row, Spacer, Text, TextInput } from '@expo/ui';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CodeEditor, githubDark } from 'react-native-codepad';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chromeFor } from '../chrome';
import { ICONS } from '../icons';
import { IconButton } from '../native/IconButton';
import { fill, fullWidth } from '../native/layout';

const snippet = [
  'function greet(name) {',
  '  const message = "Hello, " + name;',
  '  console.log(message);',
  '  return message;',
  '}',
  '',
  'const names = ["Ada", "Linus", "Grace"];',
  'for (const name of names) {',
  '  greet(name);',
  '}',
  '',
  'export default greet;',
].join('\n');

const chrome = chromeFor(githubDark);

// Caret reveal inside a parent scroll view is the consumer's job: read getCursorRect and scroll the
// parent to it. This screen only shows the auto height loop.
export function NestedScreen({ onBack }: { onBack: () => void }) {
  const [height, setHeight] = useState(120);
  const safe = useSafeAreaInsets();
  const field = {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: chrome.hairline,
    backgroundColor: chrome.surface,
  };
  const body = { fontSize: 15, color: chrome.text, lineHeight: 22 };
  return (
    <View style={[styles.screen, { backgroundColor: chrome.background }]}>
      <View
        style={[
          styles.bar,
          {
            paddingTop: safe.top,
            backgroundColor: chrome.surface,
            borderBottomColor: chrome.hairline,
          },
        ]}
      >
        <Host matchContents={{ vertical: true }} style={styles.host} colorScheme={chrome.scheme}>
          <Row alignment="center" spacing={4} style={styles.row} modifiers={fullWidth}>
            <IconButton
              icon={ICONS.back}
              label="Back to the editor"
              onPress={onBack}
              color={chrome.text}
            />
            <Text textStyle={{ fontSize: 17, fontWeight: '600', color: chrome.text }}>
              Nested scroll
            </Text>
            <Spacer flexible />
          </Row>
        </Host>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: safe.bottom + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Host matchContents style={styles.host} colorScheme={chrome.scheme}>
          <Text textStyle={body}>
            The editor below takes its height from onContentSizeChange and leaves scrolling to this
            page.
          </Text>
        </Host>
        <Host matchContents={{ vertical: true }} style={styles.host} colorScheme={chrome.scheme}>
          <Row modifiers={fullWidth}>
            <TextInput
              placeholder="A field above"
              placeholderTextColor={chrome.muted}
              style={field}
              textStyle={{ fontSize: 15, color: chrome.text }}
              modifiers={fill}
            />
          </Row>
        </Host>
        <CodeEditor
          style={{ height }}
          initialValue={snippet}
          language="javascript"
          theme={githubDark}
          softWrap
          lineNumbers
          scrollEnabled={false}
          onContentSizeChange={(e) => setHeight(Math.ceil(e.height))}
        />
        <Host matchContents={{ vertical: true }} style={styles.host} colorScheme={chrome.scheme}>
          <Row modifiers={fullWidth}>
            <TextInput
              placeholder="A field below"
              placeholderTextColor={chrome.muted}
              style={field}
              textStyle={{ fontSize: 15, color: chrome.text }}
              modifiers={fill}
            />
          </Row>
        </Host>
        <Host matchContents style={styles.host} colorScheme={chrome.scheme}>
          <Text textStyle={{ fontSize: 15, color: chrome.muted }}>
            A tall footer, so the page itself has something to scroll.
          </Text>
        </Host>
        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  host: { alignSelf: 'stretch' },
  row: { paddingHorizontal: 8, paddingVertical: 4 },
  scroll: { flex: 1 },
  content: { padding: 12, gap: 12 },
  footer: { minHeight: 900 },
});
