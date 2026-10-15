---
title: Quick start
description: A simple screen with the editor, a ref, onChange, a language and a theme.
sidebar_position: 3
---

This is a simple CodePad usage: one screen with the editor, an undo button on the ref and a status line fed by `onChange`.

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

- The editor needs a height: `flex: 1` in a column, or an explicit `height`.
- `initialValue` sets the initial text of the editor. It is read once, so use `setText()` to replace the document later.
- `language` is the id of an installed language package. Without the package the editor shows plain text.
- `theme` defaults to `githubLight`. The [themes guide](/guides/themes/) has the other two and shows how to write your own.
- `onChange` gives you one delta per change. `onChangeText` gives you the whole text after every change, so keep it for small documents.
- The ref reads synchronously (`getText()`, `getSelection()`, `getCursorRect()`) and writes asynchronously (`setText()`, `replaceRange()`, `undo()`). Everything is valid from `onReady`.

Offsets count UTF-16 code units. Lines and columns start at `0`, and ranges include the start but exclude the end, just like JavaScript strings.
