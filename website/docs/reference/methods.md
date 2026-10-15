---
title: Methods
description: The ref methods, synchronous readers and asynchronous writers.
sidebar_position: 3
---

Get the ref with `useRef<CodeEditorRef>(null)` and pass it as `ref`. Readers run on the JS thread and return at once. Writers return a promise that resolves once the change is applied. Offsets count UTF-16 code units, lines and columns start at 0, and ranges include the start but exclude the end. No method throws on bad input: ranges are clamped to the document and swapped when reversed.

## Readers

| Method | Returns | Notes |
| --- | --- | --- |
| `getText()` | `string` | The whole document. Tens of milliseconds on a multi megabyte file. |
| `getTextInRange(range)` | `string` | The text inside the range. |
| `getLength()` | `number` | The length in UTF-16 units. |
| `getLineCount()` | `number` | At least 1. |
| `getLine(index)` | `string` | An empty string out of range. |
| `getSelection()` | `Selection` | `head` is the caret. |
| `getRevision()` | `number` | 0 right after `initialValue` is loaded. |
| `offsetToPosition(offset)` | `Position` | The line and column of an offset. |
| `positionToOffset(pos)` | `number` | The offset of a line and column. |
| `getCursorRect()` | `Rect` or `null` | The caret in view coordinates, in dp. `null` before the first layout. |
| `getVisibleLines()` | `{ first, last }` | The range of lines on screen. |
| `canUndo()`, `canRedo()` | `boolean` | Refresh them from `onChange`. |
| `isFocused()` | `boolean` | Whether the editor has focus. |

## Writers

| Method | Notes |
| --- | --- |
| `setText(text, opts?)` | Replaces the document in one change with origin `api`. The selection resets to 0 and the scroll to the top. `opts.keepHistory` keeps the undo history. |
| `replaceRange(range, text)` | Replaces the range. The selection maps through the change. |
| `insertText(text)` | Replaces the selection and puts the caret after the text. This is the raw path: no auto close, no indentation, origin `api`. |
| `setSelection(sel)` | Sets the selection without scrolling. Call `revealSelection()` to show it. |
| `selectAll()` | Selects the whole document. |
| `scrollToLine(line, opts?)` | Puts the line at the top of the viewport. `opts.animated` animates the scroll. |
| `revealSelection()` | Scrolls the least amount that shows the caret. |
| `undo()`, `redo()` | Resolve as no-ops when there is nothing to undo or redo. |
| `indent()`, `outdent()` | Shift the selected lines by one level of `tabSize`, like Tab and Shift+Tab. |
| `cut()`, `copy()`, `paste()` | Use the system clipboard. A paste reports origin `input`. |
| `focus()`, `blur()` | `focus()` shows the keyboard unless `readOnly` is set. |

## Toolbar input

The keyboard path, for a key row built in JavaScript: origin `input`, typing coalesced into one undo group, and no-ops under `readOnly`.

| Method | Notes |
| --- | --- |
| `moveCaret(direction, opts?)` | Moves the caret in a `CaretDirection` from the [key table](/guides/hardware-keyboard/#the-same-table-from-javascript). `opts.select` extends the selection. Works under `readOnly`. |
| `typeText(text)` | Types the text as if from the keyboard: each character goes through the auto closer and a newline through the indenter. |
| `deleteBackward()` | Backspace: deletes one grapheme cluster, an empty auto closed pair in one go, or the selection first. |
| `deleteForward()` | Delete. |

## Search

Native keeps the query and paints the matches. See the [search guide](/guides/search/).

| Method | Notes |
| --- | --- |
| `setSearch(query)` | Sets a `SearchQuery` and resolves with the match count. Rejects when a regex does not compile. |
| `findNext()`, `findPrevious()` | Select the next or previous match, wrapping around, and reveal it. Resolve with a `SearchHit`, or `null` without a query or matches. |
| `replaceCurrent(text)` | Replaces the selected match and selects the next one. Resolves with `false` when the selection is not a match. |
| `replaceAll(text)` | Replaces every match in one undo group and resolves with the number of replacements. |
| `clearSearch()` | Drops the query and the highlights. |
