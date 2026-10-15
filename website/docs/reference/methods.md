---
title: Methods
description: The ref methods, sync readers and async writers.
sidebar_position: 3
---

Get the ref with `useRef<CodeEditorRef>(null)` and pass it as `ref`. Readers run on the JS thread and return at once. Writers resolve once the change is applied. Offsets are UTF-16 code units, lines and columns 0 based, ranges half open. No method throws for bad input: ranges clamp to the document and swap when reversed.

## Readers

| Method | Returns | Notes |
| --- | --- | --- |
| `getText()` | `string` | The whole document. Tens of milliseconds on a multi megabyte file. |
| `getTextInRange(range)` | `string` | |
| `getLength()` | `number` | UTF-16 units. |
| `getLineCount()` | `number` | At least 1. |
| `getLine(index)` | `string` | An empty string out of range. |
| `getSelection()` | `Selection` | `head` is the caret. |
| `getRevision()` | `number` | 0 after loading `initialValue`. |
| `offsetToPosition(offset)` | `Position` | |
| `positionToOffset(pos)` | `number` | |
| `getCursorRect()` | `Rect` or `null` | View coordinates, dp. `null` before the first layout. |
| `getVisibleLines()` | `{ first, last }` | The line range on screen. |
| `canUndo()`, `canRedo()` | `boolean` | Refresh them from `onChange`. |
| `isFocused()` | `boolean` | |

## Writers

| Method | Notes |
| --- | --- |
| `setText(text, opts?)` | Replaces the document in one change with origin `api`. The selection resets to 0 and the scroll to the top. `opts.keepHistory` keeps the undo history. |
| `replaceRange(range, text)` | The selection maps through the change. |
| `insertText(text)` | Replaces the selection, caret after the text. Raw: no auto close, no indentation, origin `api`. |
| `setSelection(sel)` | Does not scroll; call `revealSelection()`. |
| `selectAll()` | |
| `scrollToLine(line, opts?)` | Puts the line at the top of the viewport. `opts.animated` animates. |
| `revealSelection()` | Scrolls the least amount that shows the caret. |
| `undo()`, `redo()` | Resolve as no-ops when there is nothing to undo or redo. |
| `indent()`, `outdent()` | Shift the selected lines by one level of `tabSize`, like Tab and Shift+Tab. |
| `cut()`, `copy()`, `paste()` | The system clipboard. A paste reports origin `input`. |
| `focus()`, `blur()` | `focus()` shows the keyboard unless `readOnly` is set. |

## Toolbar input

The keyboard path, for a key row built in JavaScript: origin `input`, typing coalesces into one undo group, no-ops under `readOnly`.

| Method | Notes |
| --- | --- |
| `moveCaret(direction, opts?)` | A `CaretDirection` from the [key table](/guides/hardware-keyboard/#the-same-table-from-javascript). `opts.select` extends the selection. Works under `readOnly`. |
| `typeText(text)` | Each character goes through the auto closer, a newline through the indenter. |
| `deleteBackward()` | Backspace: by grapheme cluster, an empty auto closed pair in one go, a selection first. |
| `deleteForward()` | Delete. |

## Search

Native keeps the query and paints the matches. See the [search guide](/guides/search/).

| Method | Notes |
| --- | --- |
| `setSearch(query)` | A `SearchQuery`. Resolves with the match count. Rejects when a regex does not compile. |
| `findNext()`, `findPrevious()` | Select the next or previous match with wrap around and reveal it. Resolve with a `SearchHit`, or `null` without a query or matches. |
| `replaceCurrent(text)` | Replaces the selected match and selects the next one. `false` when the selection is not a match. |
| `replaceAll(text)` | One undo group. Resolves with the number of replacements. |
| `clearSearch()` | Drops the query and the highlights. |
