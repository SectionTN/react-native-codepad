import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { CodeEditor, githubDark } from 'react-native-codepad';

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

// Caret reveal inside a parent scroll view is the consumer's job: read getCursorRect and scroll the
// parent to it. This screen only shows the auto height loop.
export function NestedScreen() {
  const [height, setHeight] = useState(120);
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.paragraph}>
        The editor below takes its height from onContentSizeChange and leaves scrolling to this
        page.
      </Text>
      <TextInput style={styles.input} placeholder="A field above" placeholderTextColor="#8b949e" />
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
      <TextInput style={styles.input} placeholder="A field below" placeholderTextColor="#8b949e" />
      <Text style={styles.footer}>A tall footer, so the page itself has something to scroll.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 12, gap: 12 },
  paragraph: { color: '#e6edf3', fontSize: 15, lineHeight: 22 },
  input: {
    color: '#e6edf3',
    backgroundColor: '#0d1117',
    borderColor: '#30363d',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
  },
  footer: { color: '#8b949e', paddingTop: 12, minHeight: 900 },
});
