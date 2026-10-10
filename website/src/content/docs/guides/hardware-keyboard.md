---
title: Hardware keyboard
description: The keys the editor handles on each platform and what they do.
sidebar:
  order: 6
---

A Bluetooth or USB keyboard, a Chromebook, a desktop mode, an iPad keyboard or the Mac keyboard on the simulator: the editor handles the keys below, in `onKeyDown` on Android and through `UIKeyCommand`s on iOS. Everything else goes to the platform, and printable keys the keyboard did not consume insert their character through the typing path (auto close, typing coalescing in the undo history).

| Action | Android | iOS |
| --- | --- | --- |
| Move by one grapheme cluster | Left, Right | Left, Right |
| Move by one word | Ctrl+Left, Ctrl+Right | Option+Left, Option+Right |
| Move by one visual row, keeping the goal column across short lines and wrapped rows | Up, Down | Up, Down |
| Move by one viewport height | Page Up, Page Down | Page Up, Page Down |
| Line start, line end | Home, End | Home, End, Cmd+Left, Cmd+Right |
| Document start, document end | Ctrl+Home, Ctrl+End | Cmd+Home, Cmd+End, Cmd+Up, Cmd+Down |
| Extend the selection from the anchor | Shift with any of the above | Shift with any of the above |
| Newline through the indenter: copies the indentation, adds a level after an opening bracket, puts a closing bracket on its own line | Enter, numpad Enter | Enter |
| One indent unit at the caret, or indent every selected line | Tab | Tab |
| Outdent the selected lines | Shift+Tab | Shift+Tab |
| Delete one grapheme cluster backward, an empty auto closed pair in one go, or the selection | Backspace | Backspace |
| Delete forward | Delete | Forward Delete (Fn+Delete on a Mac keyboard) |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Shift+Z, Ctrl+Y | Shift+Cmd+Z |
| Select all | Ctrl+A | Cmd+A |
| Copy, cut, paste through the system clipboard | Ctrl+C, Ctrl+X, Ctrl+V, and the dedicated Copy, Cut and Paste keys | Cmd+C, Cmd+X, Cmd+V |
| Collapse the selection to the caret | Escape | Escape |

Under `readOnly` the movement keys, Shift selection, select all, copy and Escape keep working and the editing keys do nothing. Word movement uses runs of `[A-Za-z0-9_]` and otherwise the platform's word break rules; a run of whitespace counts as one word. A paste from a shortcut reports origin `input` in `onChange`, like the edit menu; undo and redo report `undo` and `redo`.

Android never handles Alt and Meta combinations and leaves Ctrl+Tab to the platform. iOS leaves Control combinations, and Option with any key other than Left and Right, to UIKit; the editor's own commands take priority over UIKit's text navigation, so the table is what a key does even where the system would do something else with it.

## The undo stack on iOS

The editor hands its history to the system: `undoManager` on the responder chain is the editor's own, so Cmd+Z and Shift+Cmd+Z, shake to undo and the three finger undo gestures run the same groups as `undo()` and `redo()` on the ref, with the same typing coalescing. On Android the history is reached through the key table and the ref only.

## The same table from JavaScript

`moveCaret(direction, { select })` on the ref drives the movement rows, so a toolbar built in JavaScript matches the keyboard exactly:

| Direction | Android | iOS |
| --- | --- | --- |
| `left`, `right` | Left, Right | Left, Right |
| `wordLeft`, `wordRight` | Ctrl+Left, Ctrl+Right | Option+Left, Option+Right |
| `lineStart`, `lineEnd` | Home, End | Home, End |
| `documentStart`, `documentEnd` | Ctrl+Home, Ctrl+End | Cmd+Home, Cmd+End |
| `up`, `down` | Up, Down | Up, Down |
| `pageUp`, `pageDown` | Page Up, Page Down | Page Up, Page Down |

`typeText('\n')`, `indent()`, `outdent()`, `deleteBackward()` and `deleteForward()` cover Enter, Tab, Shift+Tab, Backspace and Delete. The [keyboard guide](/react-native-codepad/guides/keyboard/) has the toolbar recipe.

## Testing without a keyboard

On an Android emulator with `hw.keyboard=yes` the host keyboard types into the editor, and `adb shell input keyevent` and `adb shell input keycombination` send single keys and chords from a script. On the iOS simulator the Mac keyboard types into the editor; with Connect Hardware Keyboard on it acts as a hardware keyboard, so Cmd and Option chords reach the table. `simctl` has no key injection, so the simulator test suite drives the table through the key commands directly.
