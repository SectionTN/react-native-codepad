import {
  Text as ComposeText,
  Host,
  OutlinedTextField,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CodeEditor, type Theme } from 'react-native-codepad';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAndroidColors } from '../chrome/material';
import { NestedBar } from '../chrome/NestedBar';
import { schemeFor, topInsetFor } from '../chrome/theme';
import { NESTED_SNIPPET } from './nestedSnippet';

type Props = { theme: Theme; onBack: () => void };

// Caret reveal inside a parent scroll view is the consumer's job: read getCursorRect and scroll the
// parent to it. This screen only shows the auto height loop.
export function NestedScreen({ theme, onBack }: Props) {
  const scheme = schemeFor(theme);
  const colors = useAndroidColors(scheme);
  const safe = useSafeAreaInsets();
  const [height, setHeight] = useState(120);
  const above = useNativeState('');
  const below = useNativeState('');
  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <NestedBar
        scheme={scheme}
        title="Nested scroll"
        topInset={topInsetFor(safe.top)}
        onBack={onBack}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: safe.bottom + 16,
            paddingLeft: 16 + safe.left,
            paddingRight: 16 + safe.right,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.body, { color: colors.onSurface }]}>
          The editor below takes its height from onContentSizeChange and leaves scrolling to this
          page.
        </Text>
        <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
          <OutlinedTextField value={above} modifiers={[fillMaxWidth()]}>
            <OutlinedTextField.Label>
              <ComposeText>A field above</ComposeText>
            </OutlinedTextField.Label>
          </OutlinedTextField>
        </Host>
        <CodeEditor
          style={{ height }}
          initialValue={NESTED_SNIPPET}
          language="javascript"
          theme={theme}
          softWrap
          lineNumbers
          scrollEnabled={false}
          onContentSizeChange={(e) => setHeight(Math.ceil(e.height))}
        />
        <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
          <OutlinedTextField value={below} modifiers={[fillMaxWidth()]}>
            <OutlinedTextField.Label>
              <ComposeText>A field below</ComposeText>
            </OutlinedTextField.Label>
          </OutlinedTextField>
        </Host>
        <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>
          A tall footer, so the page itself has something to scroll.
        </Text>
        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
  host: { alignSelf: 'stretch' },
  body: { fontSize: 16, lineHeight: 24 },
  footer: { minHeight: 900 },
});
