---
title: Keyboard
description: How to keep the caret visible when the keyboard opens, and how to put a toolbar above the keyboard.
sidebar_position: 3
---

To keep the caret visible while the soft keyboard is up, turn on `avoidKeyboard`, set `contentInsets` for anything you draw over the editor, and pin your toolbar to the keyboard. The example app's key row does all three.

## `avoidKeyboard`

```tsx
<CodeEditor style={{ flex: 1 }} avoidKeyboard />
```

The editor measures how much the keyboard covers it on every frame of the keyboard animation and adds that to its bottom inset. The text slides up with the keyboard and back down when it closes. A keyboard opened for another field on the screen moves the text too.

On Android the prop does nothing in two window modes, which you set with `android:windowSoftInputMode`:

- `adjustPan`: Android moves the whole window up, and an inset would move the text a second time.
- `adjustResize` without edge-to-edge: the window already got smaller. React Native apps are edge-to-edge since 0.81.

`onContentSizeChange` never includes the keyboard. The prop is off by default on both platforms.

## `contentInsets`

The editor ignores padding in `style`. `contentInsets` is the padding instead: space inside the scrollable area, in dp on Android and points on iOS. A bottom inset keeps the caret above a toolbar or a floating button.

```tsx
// Object props are compared by reference, so define them outside the component.
const INSETS = { bottom: 56 };

<CodeEditor style={{ flex: 1 }} contentInsets={INSETS} avoidKeyboard />;
```

With `avoidKeyboard` on, the editor adds the part of itself the keyboard covers on top of `contentInsets.bottom`. You pass the toolbar height, and the editor handles the keyboard.

## A toolbar on the keyboard

For a toolbar that stays on top of the keyboard, use [react-native-keyboard-controller](https://kirillzyusko.github.io/react-native-keyboard-controller/). Its `KeyboardStickyView` keeps the bar on the keyboard through the whole animation. The example app pins its key row and status bar that way. The editor takes the bar's height as its bottom inset. While the keyboard is closed, the bar is above the home indicator, and the inset covers that space too.

```tsx title="ToolbarScreen.tsx"
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
  // The editor adds the part the keyboard covers itself. The home indicator only matters while the keyboard is closed.
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

If you build the key row with a React Native `ScrollView`, set `keyboardShouldPersistTaps="always"` so that tapping a key doesn't close the keyboard. Each key calls the ref:

| Key | Call |
| --- | --- |
| Arrows, Home, End | `moveCaret(direction, { select })` |
| Tab, Untab | `indent()`, `outdent()` |
| Enter | `typeText('\n')` |
| Symbols such as `{` or `"` | `typeText(symbol)` |
| Backspace | `deleteBackward()` |
| Undo, Redo | `undo()`, `redo()` |
| Hide | `blur()` |

Read `canUndo()` and `canRedo()` in `onChange` to turn the Undo and Redo keys on and off.

`typeText()` and `deleteBackward()` behave like the keyboard. Brackets close on their own, Enter keeps the indentation, typing groups into one undo step, and `onChange` reports the origin `input`. They do nothing when `readOnly` is on. `insertText()` inserts the text exactly as given. The example's key row is in the repository under `example/src/chrome/KeyRow.ios.tsx` and `KeyRow.android.tsx`, and `BottomBar.tsx` next to them pins it to the keyboard.

## Suggestions and focus

`suggestions` controls what the keyboard offers. `off`, the default, asks the keyboard for no suggestions. `forceOff` goes further on Android: most keyboards then type each letter straight into the editor, without an underlined word in progress. `on` allows suggestions and autocorrect. Code wants `off`, and a Markdown editor might want `on`. On iOS, `forceOff` is the same as `off`. Keyboards that build characters from several keys, such as Japanese and Chinese, work in every mode.

`autoFocus` focuses the editor and opens the keyboard when the editor first appears. `focus()` and `blur()` do it on demand. When `readOnly` is on, `focus()` doesn't open the keyboard.
