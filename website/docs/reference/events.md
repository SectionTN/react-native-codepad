---
title: Events
description: The callback props, what each one receives and when it's called.
sidebar_position: 2
---

The component wraps each callback once, so an inline arrow function is fine. The payload types are on the [types page](/reference/types/).

## `onReady`

`() => void`. Called once, after the first draw with `initialValue` applied. You can call the ref methods from here on. A call before it works on an empty document.

## `onChange`

`(e: ChangeEvent) => void`. Called once for each change, including each update of a word the keyboard is still composing. The event says that the text from `start` to `end` was replaced with `text`. `revision` grows by one with each change. `origin` is `input` for the keyboard, the edit menu, `indent()`, `outdent()` and the toolbar input methods. It's `api` for `setText()`, `replaceRange()`, `insertText()`, `cut()`, `paste()`, `replaceCurrent()` and `replaceAll()`, and `undo` or `redo` for the history.

## `onChangeText`

`(text: string) => void`. Called with the whole document after each change. It copies the document on every edit, so use `onChange` for large documents.

## `onSelectionChange`

`(s: SelectionChangeEvent) => void`. Called when the selection changes, with its anchor and head in UTF-16 code units and the revision of the text. It's called at most once per frame.

## `onScroll`

`(e: ScrollEvent) => void`. Called when the editor scrolls, with the scroll offset and the content size, without the insets. It's called at most once per frame.

## `onFocus` and `onBlur`

`() => void`. Called when the editor gains or loses focus: after a tap, `focus()`, `blur()`, or the keyboard closing.

## `onContentSizeChange`

`(e: ContentSizeEvent) => void`. Called with the size at which nothing scrolls, `contentInsets` included. It's called after a draw in which that size changed, at most once per frame, and a first time before `onReady`. With `softWrap` on, the value settles over a few frames as the editor measures the lines. The height doesn't include the keyboard that `avoidKeyboard` adds. See [nested in a ScrollView](/guides/nested-scroll/).

## `onGapLayout`

`(e: GapLayoutEvent) => void`. Called after a draw in which a gap appeared, moved or was removed, scrolling included, and once after the first array with gaps is applied. `gaps` lists every gap sorted by line, in the same coordinates as `getCursorRect()`. Place a note view from it, as the [decorations guide](/guides/decorations/#a-note-under-a-line) shows.
