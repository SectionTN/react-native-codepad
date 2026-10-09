---
title: Methods
description: The ref methods, sync readers and async writers, with their semantics.
sidebar:
  order: 3
---

Get the ref with `useRef<CodeEditorRef>(null)` and pass it as `ref`. Sync readers run on the JS thread against the document under a read lock. Writers post to the main thread and resolve after the change is applied and the view is invalidated. Offsets are UTF-16 code units, lines and columns are 0 based, ranges are half open, and no method throws for bad input: ranges clamp to the document and swap when reversed.

## Readers

| Method | Returns | Notes |
| --- | --- | --- |
| `getText()` | `string` | The whole document. Tens of milliseconds on a multi megabyte file, since the string crosses the bridge as UTF-8. |
| `getTextInRange(range)` | `string` | `range` is a `Range`, clamped and swapped. |
| `getLength()` | `number` | UTF-16 units. |
| `getLineCount()` | `number` | At least 1. |
| `getLine(index)` | `string` | An empty string out of range. |
| `getSelection()` | `Selection` | `head` is the caret. |
| `getRevision()` | `number` | 0 after loading `initialValue`. |
| `offsetToPosition(offset)` | `Position` | Clamps its input. |
| `positionToOffset(pos)` | `number` | Clamps its input. |
| `getCursorRect()` | `Rect` or `null` | The caret rectangle in view coordinates, dp; `null` before the first layout. |
| `getVisibleLines()` | `{ first, last }` | The line range on screen. |
| `canUndo()`, `canRedo()` | `boolean` | Refresh them from `onChange`. |
| `isFocused()` | `boolean` | |

## Writers

| Method | Notes |
| --- | --- |
| `setText(text, opts?)` | Replaces the whole document in one change with origin `api`: `onChange` fires with `start: 0`, `end: previousLength` and the full text. The selection resets to 0 and the scroll to the top. `opts.keepHistory` keeps the undo history, otherwise it clears. |
| `replaceRange(range, text)` | Maps the selection through the change like any edit; a selection inside the replaced range collapses to the end of the inserted text. |
| `insertText(text)` | Replaces the selection and leaves the caret after the text. Raw: no auto close, no indentation, origin `api`, never merged into typing. |
| `setSelection(sel)` | Does not scroll; call `revealSelection()`. |
| `selectAll()` | |
| `scrollToLine(line, opts?)` | Puts the line at the top of the viewport, clamped to the content; `opts.animated` animates. |
| `revealSelection()` | Scrolls the least amount that shows the caret. |
| `undo()`, `redo()` | No-ops that resolve when there is nothing to undo or redo. |
| `indent()`, `outdent()` | Shift the selected lines by one level of `tabSize`, as Tab and Shift+Tab do. |
| `cut()`, `copy()`, `paste()` | The system clipboard; `paste()` with an empty clipboard resolves without a change. A paste from the edit menu reports origin `input`. |
| `focus()`, `blur()` | `focus()` shows the keyboard unless `readOnly` is set. |

## Toolbar input

The keyboard path exposed to toolbars, so a key row built in JavaScript behaves like the soft keyboard: origin `input`, typing coalesces into one undo group, and `readOnly` turns the edits into no-ops.

| Method | Notes |
| --- | --- |
| `moveCaret(direction, opts?)` | A `CaretDirection` over the hardware key table; `opts.select` extends from the anchor; `up`, `down`, `pageUp` and `pageDown` keep the goal column. Works under `readOnly` and reveals the caret afterwards. |
| `typeText(text)` | Each character goes through the auto closer and a newline through the indenter, like keystrokes. |
| `deleteBackward()` | Backspace: an empty auto closed pair goes in one go, deletion is by grapheme cluster, a selection is removed first. |
| `deleteForward()` | Delete. |

## Search

Native keeps the query and paints the matches. See the [search guide](/react-native-codepad/guides/search/).

| Method | Notes |
| --- | --- |
| `setSearch(query)` | A `SearchQuery`; resolves with the match count. Rejects when a regex does not compile, and clears the native search state when it does. |
| `findNext()`, `findPrevious()` | Select the next or previous match with wrap around and reveal it; resolve with a `SearchHit` or `null` without a query or matches. |
| `replaceCurrent(text)` | Replaces the selected match and selects the next one; `false` when the selection is not a match. |
| `replaceAll(text)` | One undo group; resolves with the number of replacements. |
| `clearSearch()` | Drops the query and the highlights. |
