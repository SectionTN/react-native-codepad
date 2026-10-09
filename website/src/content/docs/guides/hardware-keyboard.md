---
title: Hardware keyboard
description: The keys the editor handles and what they do.
sidebar:
  order: 6
---

A Bluetooth or USB keyboard, a Chromebook, a desktop mode: the editor handles the keys below in `onKeyDown` on Android. Everything else goes to the platform, and printable keys the keyboard app did not consume insert their character. Alt and Meta combinations are never handled.

| Key | Action |
| --- | --- |
| Left, Right | Move by one grapheme cluster |
| Ctrl+Left, Ctrl+Right | Move by one word |
| Up, Down | Move by one visual row, keeping the goal column across short lines and wrapped rows |
| Page Up, Page Down | Move by one viewport height |
| Home, End | Line start, line end |
| Ctrl+Home, Ctrl+End | Document start, document end |
| Shift with any of the above | Extend the selection from the anchor |
| Enter, numpad Enter | Newline through the indenter: copies the indentation, adds a level after an opening bracket, puts a closing bracket on its own line |
| Tab | One indent unit at the caret, or indent every selected line |
| Shift+Tab | Outdent the selected lines |
| Backspace | Delete one grapheme cluster backward, an empty auto closed pair in one go, or the selection |
| Delete | Delete forward |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z, Ctrl+Y | Redo |
| Ctrl+A | Select all |
| Ctrl+C, Ctrl+X, Ctrl+V | Copy, cut, paste through the system clipboard; the dedicated Copy, Cut and Paste keys do the same |
| Escape | Collapse the selection to the caret |

Under `readOnly` the movement keys, Shift selection, Ctrl+A, Ctrl+C and Escape keep working and the editing keys do nothing. Ctrl+Tab is left to the platform. Word movement uses runs of `[A-Za-z0-9_]` and otherwise the platform's word break rules; a run of whitespace counts as one word.

A paste from a shortcut reports origin `input` in `onChange`, like the edit menu; undo and redo report `undo` and `redo`.

## The same table from JavaScript

`moveCaret(direction, { select })` on the ref drives the movement rows, so a toolbar built in JavaScript matches the keyboard exactly:

| Direction | Key |
| --- | --- |
| `left`, `right` | Left, Right |
| `wordLeft`, `wordRight` | Ctrl+Left, Ctrl+Right |
| `lineStart`, `lineEnd` | Home, End |
| `documentStart`, `documentEnd` | Ctrl+Home, Ctrl+End |
| `up`, `down` | Up, Down |
| `pageUp`, `pageDown` | Page Up, Page Down |

`typeText('\n')`, `indent()`, `outdent()`, `deleteBackward()` and `deleteForward()` cover Enter, Tab, Shift+Tab, Backspace and Delete. The [keyboard guide](/react-native-codepad/guides/keyboard/) has the toolbar recipe.

## iOS

The iOS editor will handle the same table through `UIKeyCommand`, with Cmd in place of Ctrl for the shortcuts and Option for word movement, and expose the undo stack to the system so Cmd+Z, shake and the menu all reach it.

## Testing without a keyboard

On an emulator with `hw.keyboard=yes` the host keyboard types into the editor. `adb shell input keyevent` and `adb shell input keycombination` send single keys and chords from a script.
