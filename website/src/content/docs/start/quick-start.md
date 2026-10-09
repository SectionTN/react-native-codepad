---
title: Quick start
description: A screen with the editor, a ref, onChange, a language and a theme.
sidebar:
  order: 3
---

One screen, one editor, the pieces you will use most. The editor takes its size from `style` like any view and needs a bounded height: `flex: 1` inside a flex column, or an explicit `height`.

```tsx
import { useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { CodeEditor, type CodeEditorRef, githubDark } from 'react-native-codepad';

const INITIAL = ['export function greet(name) {', '  return `Hello, ${name}`;', '}'].join('\n');

// Object props are compared by identity; a literal in JSX would cross to native on every render.
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

What each piece does:

- `initialValue` is read once at mount. Later changes to the prop are ignored; replace the document with `setText()`.
- `language` is the grammar name of an installed package. Without the package the editor shows plain text and logs one warning.
- `theme` defaults to `githubLight`. Three themes ship; the [themes guide](/react-native-codepad/guides/themes/) shows how to build your own.
- `onChange` gives you a delta per committed change, composition updates included. `onChangeText` sends the full text instead, at the cost of a copy per edit; keep it for small documents.
- The ref exposes sync readers (`getText()`, `getSelection()`, `getCursorRect()`) that return on the JS thread, and async writers (`setText()`, `replaceRange()`, `undo()`) that resolve once the change is applied. Everything is valid from `onReady`; earlier calls work on an empty document and never throw.

Offsets are UTF-16 code units, lines and columns are 0 based and ranges are half open, the same conventions as JavaScript strings. The [reference](/react-native-codepad/reference/props/) has every prop, event and method; the guides cover the [keyboard](/react-native-codepad/guides/keyboard/), [search](/react-native-codepad/guides/search/) and [nesting the editor in a page](/react-native-codepad/guides/nested-scroll/).
