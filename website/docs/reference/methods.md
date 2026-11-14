---
title: Methods
description: The ref methods, the readers that return right away and the writers that return a promise.
sidebar_position: 3
---

Get the ref with `useRef<CodeEditorRef>(null)` and pass it as `ref`. Readers return their value right away. Writers return a promise that resolves once the change is applied. Offsets count UTF-16 code units. Lines and columns start at 0, and a range includes its start but excludes its end.

No method throws on bad input. A range outside the document is cut to fit it, and a range whose end comes before its start is swapped. Only `setSearch()` rejects, when a regular expression doesn't compile.

## Readers

| Method | Returns | Notes |
| --- | --- | --- |
| `getText()` | `string` | Returns the whole document. It takes tens of milliseconds on a file of several megabytes. |
| `getTextInRange(range)` | `string` | Returns the text inside the range. |
| `getLength()` | `number` | Returns the length of the document in UTF-16 code units. |
| `getLineCount()` | `number` | Returns the number of lines, which is at least 1. |
| `getLine(index)` | `string` | Returns the text of one line, or an empty string when the line doesn't exist. |
| `getSelection()` | `Selection` | Returns the selection. Its `head` is the caret. |
| `getRevision()` | `number` | Returns the revision of the text. It's 0 right after `initialValue` is loaded and grows by one with each change. |
| `offsetToPosition(offset)` | `Position` | Returns the line and column of an offset. |
| `positionToOffset(pos)` | `number` | Returns the offset of a line and column. |
| `getCursorRect()` | `Rect` or `null` | Returns the caret's rectangle in the editor view's own coordinates, or `null` before the first layout. |
| `getVisibleLines()` | `{ first, last }` | Returns the first and last lines on screen. |
| `getGapRect(line)` | `Rect` or `null` | Returns the gap under a line as the last frame drew it, in the same coordinates as `getCursorRect()`. It returns `null` when the line has no gap. |
| `canUndo()`, `canRedo()` | `boolean` | Return whether there is a step to undo or redo. Read them again in `onChange` to keep your buttons up to date. |
| `isFocused()` | `boolean` | Returns whether the editor has focus. |

## Writers

| Method | Returns | Notes |
| --- | --- | --- |
| `setText(text, opts?)` | `Promise<void>` | Replaces the document in one change with the origin `api`. The selection moves to the start and the scroll to the top. `opts.keepHistory` keeps the undo history. |
| `replaceRange(range, text)` | `Promise<void>` | Replaces the text in the range. The selection moves with the change. |
| `insertText(text)` | `Promise<void>` | Replaces the selection with the text, as given, and puts the caret after it. Brackets don't close, the indentation stays as typed, and the change has the origin `api`. |
| `setSelection(sel)` | `Promise<void>` | Sets the selection without scrolling. Call `revealSelection()` to show it. |
| `selectAll()` | `Promise<void>` | Selects the whole document. |
| `scrollToLine(line, opts?)` | `Promise<void>` | Scrolls so that the line is at the top of the editor. `opts.animated` animates the scroll. |
| `revealSelection()` | `Promise<void>` | Scrolls as little as needed to show the caret. |
| `undo()`, `redo()` | `Promise<void>` | Undo or redo one step. They resolve without a change when there is nothing to undo or redo. |
| `indent()`, `outdent()` | `Promise<void>` | Shift the selected lines by one level of `tabSize`, like Tab and Shift+Tab. |
| `cut()`, `copy()`, `paste()` | `Promise<void>` | Use the system clipboard. `cut()` and `paste()` report the origin `api` and do nothing when `readOnly` is on. |
| `focus()`, `blur()` | `Promise<void>` | Focus or unfocus the editor. `focus()` opens the keyboard unless `readOnly` is on. |

## Toolbar input

These methods behave like the keyboard, for a key row built in JavaScript. Their changes have the origin `input`, and typing groups into one undo step. They do nothing when `readOnly` is on, except `moveCaret()`.

| Method | Returns | Notes |
| --- | --- | --- |
| `moveCaret(direction, opts?)` | `Promise<void>` | Moves the caret in a `CaretDirection` from the [key table](/guides/hardware-keyboard/#the-same-table-from-javascript). `opts.select` extends the selection. It also works when `readOnly` is on. |
| `typeText(text)` | `Promise<void>` | Types the text as the keyboard would. Brackets close on their own, and a newline keeps the indentation. |
| `deleteBackward()` | `Promise<void>` | Works like Backspace. It deletes the selection when there is one. Otherwise it deletes one character, or an empty pair of brackets at once. An emoji or an accented letter counts as one character. |
| `deleteForward()` | `Promise<void>` | Works like the Delete key. |

## Search

The editor keeps the query and paints the matches itself. The [search guide](/guides/search/) shows a find bar.

| Method | Returns | Notes |
| --- | --- | --- |
| `setSearch(query)` | `Promise<{ count, limited }>` | Sets a `SearchQuery` and resolves with the number of matches. `limited` is `true` when a very complex regular expression stopped early, and `count` then covers only the matches found before that point. It rejects when a regular expression doesn't compile. |
| `findNext()`, `findPrevious()` | `Promise<SearchHit \| null>` | Select the next or previous match, wrapping around, and scroll to it. They resolve with a `SearchHit`, or with `null` when there is no query or no match. |
| `replaceCurrent(text)` | `Promise<boolean>` | Replaces the selected match and selects the next one. It resolves with `false` when the selection isn't a match. |
| `replaceAll(text)` | `Promise<number>` | Replaces every match in one undo step and resolves with the number of replacements. |
| `clearSearch()` | `Promise<void>` | Clears the query and the highlights. |
