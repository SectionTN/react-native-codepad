import { Host, TextField } from '@expo/ui/swift-ui';
import { background, cornerRadius, padding } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CodeEditor, type Theme } from 'react-native-codepad';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NestedBar } from '../chrome/NestedBar';
import { IOS, schemeFor } from '../chrome/theme';
import { NESTED_SNIPPET } from './nestedSnippet';

type Props = { theme: Theme; onBack: () => void };

// Caret reveal inside a parent scroll view is the consumer's job: read getCursorRect and scroll the
// parent to it. This screen only shows the auto height loop.
export function NestedScreen({ theme, onBack }: Props) {
  const scheme = schemeFor(theme);
  const palette = IOS[scheme];
  const safe = useSafeAreaInsets();
  const [height, setHeight] = useState(120);
  const [barHeight, setBarHeight] = useState(0);
  // The inset grouped field look: a rounded fill on the page, no border.
  const field = [
    padding({ horizontal: 12, vertical: 11 }),
    background(palette.fieldBackground),
    cornerRadius(10),
  ];
  return (
    <View style={[styles.screen, { backgroundColor: palette.systemBackground }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: barHeight + 8, paddingBottom: safe.bottom + 16 },
        ]}
        scrollIndicatorInsets={{ top: barHeight }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.body, { color: palette.label }]}>
          The editor below takes its height from onContentSizeChange and leaves scrolling to this
          page.
        </Text>
        <Host matchContents={{ vertical: true }} colorScheme={scheme} style={styles.host}>
          <TextField placeholder="A field above" modifiers={field} />
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
          <TextField placeholder="A field below" modifiers={field} />
        </Host>
        <Text style={[styles.body, { color: palette.secondaryLabel }]}>
          A tall footer, so the page itself has something to scroll.
        </Text>
        <View style={styles.footer} />
      </ScrollView>
      <View
        style={styles.chrome}
        pointerEvents="box-none"
        onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
      >
        <NestedBar scheme={scheme} title="Nested scroll" topInset={safe.top} onBack={onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The bar floats over the page like the editor's; the content starts below its measured height.
  chrome: { position: 'absolute', top: 0, left: 0, right: 0 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
  host: { alignSelf: 'stretch' },
  body: { fontSize: 17, lineHeight: 22 },
  footer: { minHeight: 900 },
});
