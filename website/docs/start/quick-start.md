---
title: Quick start
description: One screen with the editor, a ref, onChange, a language and a theme.
sidebar_position: 3
---

One screen, one editor. The editor sizes like any view and needs a bounded height: `flex: 1` in a column, or an explicit `height`.

```tsx
import { useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { CodeEditor, type CodeEditorRef, githubDark } from 'react-native-codepad';

const INITIAL = ['export function greet(name) {', '  return `Hello, ${name}`;', '}'].join('\n');

// Object props are compared by identity; hoist them out of the render.
const INSETS = { bottom: 24 };

export function EditorScreen() {
  const editor = useRef<CodeEditorRef>(null);
  const [revision, setRevision] = useState(0);
  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Text style={styles.status}>revision {revision}</Text>
        <Button title="Undo" onPress={() => editor.current?.undo()} />
        <Button title="Log" onPress={() => console.log(editor.current?.getText())} />
      </View>
      <CodeEditor
        ref={editor}
        style={styles.editor}
        initialValue={INITIAL}
        language="javascript"
        theme={githubDark}
        contentInsets={INSETS}
        onReady={() => console.log('lines', editor.current?.getLineCount())}
        onChange={(e) => setRevision(e.revision)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0d1117' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  status: { color: '#8b949e', flex: 1 },
  editor: { flex: 1 },
});
```

- `initialValue` is read once. Replace the document with `setText()`.
- `language` is an installed package's id. Without the package the editor shows plain text.
- `theme` defaults to `githubLight`. [Themes](/guides/themes/) has the other two and your own.
- `onChange` is one delta per change. `onChangeText` sends the whole text; keep it for small documents.
- The ref reads synchronously (`getText()`, `getSelection()`, `getCursorRect()`) and writes asynchronously (`setText()`, `replaceRange()`, `undo()`). Everything is valid from `onReady`.

Offsets are UTF-16 code units, lines and columns are 0 based, ranges are half open: JavaScript string conventions.

Next: the [props](/reference/props/), the [keyboard](/guides/keyboard/), [search](/guides/search/), or [nesting the editor in a page](/guides/nested-scroll/).
