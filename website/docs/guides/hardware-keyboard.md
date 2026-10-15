---
title: Hardware keyboard
description: The keys the editor handles on each platform.
sidebar_position: 6
---

A Bluetooth or USB keyboard, a Chromebook, an iPad keyboard, the Mac keyboard on the simulator: the editor handles the keys below. Everything else goes to the platform, and printable keys type through the normal path (auto close, typing coalescing).

| Action | Android | iOS |
| --- | --- | --- |
| Move by one grapheme cluster | Left, Right | Left, Right |
| Move by one word | Ctrl+Left, Ctrl+Right | Option+Left, Option+Right |
| Move by one visual row, keeping the goal column | Up, Down | Up, Down |
| Move by one viewport height | Page Up, Page Down | Page Up, Page Down |
| Line start, line end | Home, End | Home, End, Cmd+Left, Cmd+Right |
| Document start, document end | Ctrl+Home, Ctrl+End | Cmd+Home, Cmd+End, Cmd+Up, Cmd+Down |
| Extend the selection | Shift with any of the above | Shift with any of the above |
| Newline through the indenter | Enter, numpad Enter | Enter |
| Indent the caret or the selected lines | Tab | Tab |
| Outdent the selected lines | Shift+Tab | Shift+Tab |
| Delete backward (an empty auto closed pair goes in one go) | Backspace | Backspace |
| Delete forward | Delete | Forward Delete (Fn+Delete on a Mac keyboard) |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Shift+Z, Ctrl+Y | Shift+Cmd+Z |
| Select all | Ctrl+A | Cmd+A |
| Copy, cut, paste | Ctrl+C, Ctrl+X, Ctrl+V, the dedicated keys | Cmd+C, Cmd+X, Cmd+V |
| Collapse the selection to the caret | Escape | Escape |

Under `readOnly` movement, selection, select all, copy and Escape work; the editing keys do nothing. Word movement uses runs of `[A-Za-z0-9_]`, otherwise the platform's word breaks. A paste reports origin `input` in `onChange`; undo and redo report `undo` and `redo`.

Android leaves Alt and Meta combinations and Ctrl+Tab to the platform. iOS leaves Control combinations, and Option with any key other than Left and Right, to UIKit. The editor's commands win over UIKit's own text navigation.

## The undo stack on iOS

The editor's history is the responder chain's `undoManager`: Cmd+Z, shake to undo and the three finger gestures run the same groups as `undo()` and `redo()`. On Android the history is reached through the key table and the ref.

## The same table from JavaScript

`moveCaret(direction, { select })` drives the movement rows, so a toolbar matches the keyboard:

| Direction | Android | iOS |
| --- | --- | --- |
| `left`, `right` | Left, Right | Left, Right |
| `wordLeft`, `wordRight` | Ctrl+Left, Ctrl+Right | Option+Left, Option+Right |
| `lineStart`, `lineEnd` | Home, End | Home, End |
| `documentStart`, `documentEnd` | Ctrl+Home, Ctrl+End | Cmd+Home, Cmd+End |
| `up`, `down` | Up, Down | Up, Down |
| `pageUp`, `pageDown` | Page Up, Page Down | Page Up, Page Down |

`typeText('\n')`, `indent()`, `outdent()`, `deleteBackward()` and `deleteForward()` cover Enter, Tab, Shift+Tab, Backspace and Delete. The [keyboard guide](/guides/keyboard/) has the toolbar recipe.

## Testing without a keyboard

On an Android emulator with `hw.keyboard=yes` the host keyboard types into the editor, and `adb shell input keyevent` sends keys from a script. On the iOS simulator the Mac keyboard types into the editor; with Connect Hardware Keyboard on, Cmd and Option chords reach the table.
