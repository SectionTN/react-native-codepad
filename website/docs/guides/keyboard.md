---
title: Keyboard
description: How to keep the caret visible when the keyboard opens, and how to put a toolbar above the keyboard.
sidebar_position: 3
---

Three things keep the caret visible while the soft keyboard is up: `avoidKeyboard`, `contentInsets` for anything you draw over the editor, and a toolbar pinned to the keyboard. The example app's key row uses all three.

## `avoidKeyboard`

```tsx
<CodeEditor style={{ flex: 1 }} avoidKeyboard />
```

The editor measures how much the keyboard overlaps it on every frame of the keyboard animation and adds that to its bottom inset, so the content slides up with the keyboard and back down when it closes. A keyboard opened for another field insets the editor too.

On Android the prop does nothing in two window modes, on purpose:

- `adjustPan`: the framework pans the window, and an inset would move the content twice.
- `adjustResize` without edge to edge: the window already shrank. React Native is edge to edge since 0.81.

`onContentSizeChange` never includes the keyboard overlap. The prop is off by default on both platforms.

## `contentInsets`

Style padding on the view is ignored. `contentInsets` is the padding instead: inside the scrollable area, in dp on Android and points on iOS. A bottom inset keeps the caret above a toolbar or a floating button.

```tsx
// Hoisted: object props are compared by identity.
const INSETS = { bottom: 56 };

<CodeEditor style={{ flex: 1 }} contentInsets={INSETS} avoidKeyboard />;
```

With `avoidKeyboard` on, the keyboard overlap is added on top of `contentInsets.bottom`. You pass the toolbar height, the editor adds the keyboard.

## A toolbar on the keyboard

For a toolbar that rides the keyboard, use [react-native-keyboard-controller](https://kirillzyusko.github.io/react-native-keyboard-controller/). Its `KeyboardStickyView` keeps the bar on top of the keyboard through the whole animation. The example app pins its key row and status bar that way: the editor takes the bar's height as its bottom inset, and while the keyboard is closed the bar is above the home indicator, so the inset covers that band too.

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

If you build the key row with a React Native `ScrollView`, set `keyboardShouldPersistTaps="always"` so tapping a key does not dismiss the keyboard. Each key calls the ref:

| Key | Call |
| --- | --- |
| Arrows, Home, End | `moveCaret(direction, { select })` |
| Tab, Untab | `indent()`, `outdent()` |
| Enter | `typeText('\n')` |
| Symbols such as `{` or `"` | `typeText(symbol)` |
| Backspace | `deleteBackward()` |
| Undo, Redo | `undo()`, `redo()`, enabled from `canUndo()` and `canRedo()` read in `onChange` |
| Hide | `blur()` |

`typeText()` and `deleteBackward()` take the keyboard path: auto close, the indenter, typing coalesced in the undo history, origin `input`, and no-ops under `readOnly`. `insertText()` is the raw path. The example's key row is in the repository under `example/src/components/AccessoryBar.tsx`, and `BottomBar.tsx` next to it pins it to the keyboard.

## Suggestions and focus

`suggestions` controls what the keyboard offers: `off` (the default) asks for no suggestions, `forceOff` also kills composition on most Android keyboards, and `on` allows autocorrect. Code wants `off`. A Markdown editor might want `on`. On iOS `forceOff` is the same as `off`. Composing keyboards (Japanese, Chinese) work in every mode.

`autoFocus` focuses the editor once the view is attached. `focus()` and `blur()` do it on demand, and `focus()` doesn't open the keyboard under `readOnly`.
