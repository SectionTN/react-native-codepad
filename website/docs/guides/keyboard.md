---
title: Keyboard
description: avoidKeyboard, content insets and a toolbar that rides the keyboard.
sidebar_position: 3
---

Three things keep the caret visible while the soft keyboard is up: the editor's own keyboard avoidance, `contentInsets` for anything you draw over the editor, and a toolbar pinned to the keyboard. The example app's Toolbar tab combines all three.

## avoidKeyboard

```tsx
<CodeEditor style={{ flex: 1 }} avoidKeyboard />
```

With `avoidKeyboard` the view follows the keyboard itself and on every frame of the keyboard animation adds the overlap between the keyboard and its own bounds to the bottom content inset. The scroll clamps, a caret near the bottom is revealed, and the content slides with the keyboard instead of jumping when the animation ends. Closing the keyboard removes the inset the same way.

On Android the view registers a window insets animation callback and reads the keyboard inset per frame; the emoji panel, a height change of the keyboard and a rotation go through the plain insets listener and apply without animation. On iOS a zero height tracking view is pinned to the window's keyboard layout guide, and while a keyboard notification's animation runs a display link reads the tracking view's presentation frame on every tick and converts it into the editor's coordinates, so the inset follows the keyboard's own curve rather than an interpolation of the notification's values; the last tick applies the end value, and a keyboard already up when the editor attaches applies at once.

What it measures is the overlap, not the keyboard height: an editor that ends above the keyboard gets nothing, an editor that fills the screen gets the keyboard height, an editor inside a React Native `Modal` measures against the window that hosts the modal. A keyboard opened for another field insets the editor too, like any scroll container would.

Two cases where it does nothing on purpose, both on Android, where the window itself can move or shrink under the keyboard:

- The activity window uses `adjustPan`. The framework pans the whole window, and an inset on top would move the content twice.
- The window is not edge to edge and uses the legacy `adjustResize`. The content area already shrank, so the overlap computes to zero. React Native is edge to edge by default since 0.81, where the overlap is the keyboard.

iOS has no window resize to account for, so the overlap is always what the keyboard covers.

`onContentSizeChange` never includes the keyboard overlap, so an editor sized from that event does not grow when the keyboard opens. The default is off on both platforms.

## contentInsets

`contentInsets` is the only padding mechanism (style padding on the view is ignored) and the bottom inset is how you keep the caret above something you draw over the editor: a toolbar, a status bar, a floating button. It is in dp on Android and points on iOS, applies inside the scrollable area, and is included in `onContentSizeChange`. Changing it keeps the layouts and clamps the scroll; nothing relayouts.

```tsx
// Hoisted: the object is compared by identity before it crosses to native.
const INSETS = { bottom: 56 };

<CodeEditor style={{ flex: 1 }} contentInsets={INSETS} avoidKeyboard />;
```

With `avoidKeyboard` on, the keyboard overlap is added on top of `contentInsets.bottom`, so the two compose: the toolbar height in the prop, the keyboard from the view.

## A toolbar on the keyboard

The Toolbar tab of the example app pins a key row to the keyboard with react-native-keyboard-controller. The editor avoids the keyboard itself and takes the toolbar height as its bottom inset; while the keyboard is closed the toolbar rests above the gesture bar or the home indicator, so the inset also covers that band then.

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
  // The editor adds the keyboard overlap itself; the gesture bar only matters while the keyboard is closed.
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

The toolbar itself is a horizontal `ScrollView` of buttons with `keyboardShouldPersistTaps="always"`, so a tap on a key does not dismiss the keyboard. Its keys call the ref:

| Key | Call |
| --- | --- |
| Arrows, Home, End | `moveCaret(direction, { select })` |
| Tab, Untab | `indent()`, `outdent()` |
| Enter | `typeText('\n')` |
| Symbols such as `{` or `"` | `typeText(symbol)` |
| Backspace | `deleteBackward()` |
| Undo, Redo | `undo()`, `redo()`, enabled from `canUndo()` and `canRedo()` read in `onChange` |
| Hide | `blur()` |

`typeText()` and `deleteBackward()` are the keyboard path: auto close, the indenter on a newline, typing coalescing in the undo history, origin `input` in `onChange`, no-ops under `readOnly`. `insertText()` is the raw path with none of that. The full table is on the [methods page](/reference/methods/#toolbar-input), and the key row's source is in the repository under `example/src/components/EditorToolbar.tsx`.

## Suggestions and focus

`suggestions` controls what the keyboard is allowed to do: `off` (the default) asks for no suggestions, `forceOff` also kills composition on most Android keyboards by presenting the field as a visible password, and `on` allows autocorrect. Code wants `off`; prose in a markdown editor may want `on`. On iOS `forceOff` equals `off`, since the input traits already turn autocorrection, spell checking, inline predictions and the smart punctuation off; `on` turns the first three back on and keeps smart quotes and dashes off. The keyboard type stays the default on both platforms, so Japanese, Chinese and other composing keyboards work through marked text.

`autoFocus` focuses and shows the keyboard once the view is attached. `focus()` and `blur()` do the same on demand; `focus()` shows no keyboard under `readOnly`, where a tap still places the caret and the edit menu still copies.
