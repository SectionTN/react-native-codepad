---
title: Keyboard
description: avoidKeyboard, content insets and a toolbar on the keyboard.
sidebar_position: 3
---

Three things keep the caret visible with the soft keyboard up: `avoidKeyboard`, `contentInsets` for anything you draw over the editor, and a toolbar pinned to the keyboard. The example app's Toolbar tab combines all three.

## avoidKeyboard

```tsx
<CodeEditor style={{ flex: 1 }} avoidKeyboard />
```

The view measures its overlap with the keyboard on every frame of the keyboard animation and adds it to the bottom inset, so the content slides with the keyboard. Closing it removes the inset the same way. A keyboard opened for another field insets the editor too.

Two Android windows where it does nothing on purpose:

- `adjustPan`: the framework pans the window, and an inset would move the content twice.
- `adjustResize` without edge to edge: the window already shrank. React Native is edge to edge since 0.81.

`onContentSizeChange` never includes the overlap. Default off on both platforms.

## contentInsets

Style padding on the view is ignored. `contentInsets` is the padding, inside the scrollable area, in dp on Android and points on iOS. The bottom inset keeps the caret above a toolbar or a floating button.

```tsx
// Hoisted: object props are compared by identity.
const INSETS = { bottom: 56 };

<CodeEditor style={{ flex: 1 }} contentInsets={INSETS} avoidKeyboard />;
```

With `avoidKeyboard` the overlap adds to `contentInsets.bottom`: the toolbar height in the prop, the keyboard from the view.

## A toolbar on the keyboard

The example app pins a key row to the keyboard with react-native-keyboard-controller. The editor takes the toolbar height as its bottom inset; with the keyboard closed the toolbar sits above the home indicator, so the inset covers that band too.

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
  // The editor adds the keyboard overlap itself; the home indicator only matters while the keyboard is closed.
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

The toolbar is a horizontal `ScrollView` with `keyboardShouldPersistTaps="always"`, so a key does not dismiss the keyboard. Its keys call the ref:

| Key | Call |
| --- | --- |
| Arrows, Home, End | `moveCaret(direction, { select })` |
| Tab, Untab | `indent()`, `outdent()` |
| Enter | `typeText('\n')` |
| Symbols such as `{` or `"` | `typeText(symbol)` |
| Backspace | `deleteBackward()` |
| Undo, Redo | `undo()`, `redo()`, enabled from `canUndo()` and `canRedo()` read in `onChange` |
| Hide | `blur()` |

`typeText()` and `deleteBackward()` are the keyboard path: auto close, the indenter, typing coalescing in the undo history, origin `input`, no-ops under `readOnly`. `insertText()` is the raw path. The key row's source is in the repository under `example/src/components/EditorToolbar.tsx`.

## Suggestions and focus

`suggestions`: `off` (the default) asks the keyboard for none, `forceOff` also kills composition on most Android keyboards, `on` allows autocorrect. Code wants `off`; a markdown editor may want `on`. On iOS `forceOff` equals `off`. Composing keyboards (Japanese, Chinese) work in every mode.

`autoFocus` focuses once the view is attached. `focus()` and `blur()` do it on demand; `focus()` shows no keyboard under `readOnly`.
