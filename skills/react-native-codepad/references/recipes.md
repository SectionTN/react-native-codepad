# Recipes

Working patterns from the docs and the example app. Adapt names and styling to the project.

## Contents

- Custom theme
- Keyboard toolbar
- Find and replace bar
- Auto height editor in a ScrollView

## Custom theme

Spread a built-in theme (`githubLight` is the default, `githubDark` and `oneDark` ship too) and override what differs. Define it at module scope.

```ts
import { githubDark, type Theme } from 'react-native-codepad';

export const midnight: Theme = {
  ...githubDark,
  background: '#000000',
  gutterBackground: '#000000',
  tokens: {
    ...githubDark.tokens,
    keyword: { color: '#ff9bce', bold: true },
    'string.regexp': '#ffd27f',
    comment: { color: '#6b7280', italic: true },
  },
};
```

- `tokens` keys are tree-sitter capture names. Lookup walks dotted prefixes from the longest down (`keyword.return`, then `keyword`) and ends at `foreground`.
- An nvim-treesitter theme ports by dropping the `@`: `@keyword.return` becomes `keyword.return`.
- Colors are `#rrggbb` or `#rrggbbaa`. `selection`, `matchingBracket`, `searchMatch` and `searchMatchActive` paint under the text, so give them alpha.
- Bold and italic need a font with those faces. The defaults (`monospace` on Android, `Menlo` on iOS) have them.
- Follow the system scheme with `useColorScheme()` and pick between two hoisted themes.

## Keyboard toolbar

Pin a key row to the keyboard with react-native-keyboard-controller's `KeyboardStickyView`, and give the editor the row's height as its bottom inset. `avoidKeyboard` adds the keyboard overlap on top.

```tsx
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CodeEditor, type CodeEditorRef } from 'react-native-codepad';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorToolbar } from './EditorToolbar';

export function ToolbarScreen() {
  const editor = useRef<CodeEditorRef>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  const safe = useSafeAreaInsets();
  const lift = keyboardVisible ? 0 : safe.bottom;
  const insets = useMemo(() => ({ bottom: toolbarHeight + lift }), [toolbarHeight, lift]);
  const offset = useMemo(() => ({ closed: -safe.bottom, opened: 0 }), [safe.bottom]);
  return (
    <View style={styles.screen}>
      <CodeEditor
        ref={editor}
        style={styles.editor}
        language="javascript"
        avoidKeyboard
        contentInsets={insets}
      />
      <KeyboardStickyView offset={offset} style={styles.sticky}>
        <EditorToolbar
          editor={editor}
          onLayout={(e) => setToolbarHeight(e.nativeEvent.layout.height)}
        />
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  editor: { flex: 1 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
```

Each key calls the ref. A key row in a `ScrollView` needs `keyboardShouldPersistTaps="always"` so a tap does not close the keyboard.

| Key | Call |
| --- | --- |
| Arrows, Home, End | `moveCaret(direction, { select })` |
| Tab, Untab | `indent()`, `outdent()` |
| Enter | `typeText('\n')` |
| Symbols such as `{` or `"` | `typeText(symbol)` |
| Backspace | `deleteBackward()` |
| Undo, Redo | `undo()`, `redo()`, enabled from `canUndo()` and `canRedo()` read in `onChange` |
| Hide | `blur()` |

## Find and replace bar

One effect per query change. The `live` flag drops a result that arrives after the query changed.

```tsx
useEffect(() => {
  let live = true;
  (async () => {
    if (!text) {
      await editor.current?.clearSearch();
      if (live) setMatch({ index: 0, count: 0 });
      return;
    }
    try {
      const result = await editor.current?.setSearch({ text, regex, caseSensitive, wholeWord });
      if (!live || !result?.count) return;
      const hit = await editor.current?.findNext();
      if (live && hit) setMatch({ index: hit.index + 1, count: hit.total });
    } catch (e) {
      if (live) setError(e instanceof Error ? e.message : String(e));
    }
  })();
  return () => {
    live = false;
  };
}, [text, regex, caseSensitive, wholeWord]);
```

- `findNext()` and `findPrevious()` wrap around and resolve `{ index, total }` (0 based) or `null` without matches.
- `replaceCurrent(text)` replaces the selected match and selects the next. `replaceAll(text)` is one undo group and resolves the count.
- Regex is ICU on both platforms, and matches never overlap.

## Auto height editor in a ScrollView

For a short document inside a form. The page scrolls, the editor grows.

```tsx
import { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';
import { CodeEditor } from 'react-native-codepad';

export function NoteForm() {
  const [height, setHeight] = useState(120);
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <TextInput placeholder="Title" />
      <CodeEditor
        style={{ height }}
        language="markdown"
        softWrap
        scrollEnabled={false}
        onContentSizeChange={(e) => setHeight(Math.ceil(e.height))}
      />
      <TextInput placeholder="Tags" />
    </ScrollView>
  );
}
```

The editor cannot scroll the page. To keep the caret visible, read `getCursorRect()` in `onSelectionChange`, add the editor's `onLayout` offset, and call `scrollTo` on the page when the caret leaves the visible band. Handle the keyboard at the page level (`KeyboardAvoidingView` or keyboard-controller's `KeyboardAwareScrollView`), not with `avoidKeyboard`.
