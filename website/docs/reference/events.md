---
title: Events
description: The callback props, what they carry and when they fire.
sidebar_position: 2
---

Every callback is wrapped once by the component, so an inline arrow function is fine. The payload types are on the [types page](/reference/types/).

## `onReady`

`() => void`. Fires once, after the first draw with `initialValue` applied. Ref methods are valid from here, and a call before it operates on an empty document.

## `onChange`

`(e: ChangeEvent) => void`. Fires once per committed change, composition updates included, with a delta: `[start, end)` was replaced with `text`. `revision` grows by one per change. `origin` is `input` for the keyboard, the edit menu and the toolbar methods, `api` for `setText()`, `replaceRange()` and `insertText()`, and `undo` or `redo` for history.

## `onChangeText`

`(text: string) => void`. The full document after every change, at the cost of one copy per edit. Prefer `onChange` on large documents.

## `onSelectionChange`

`(s: SelectionChangeEvent) => void`. The anchor and head in UTF-16 units plus their revision. At most one event per frame.

## `onScroll`

`(e: ScrollEvent) => void`. The scroll offset and the content extent in dp, without insets. At most one event per frame.

## `onFocus` and `onBlur`

`() => void`. Focus follows the native view: a tap, `focus()`, `blur()`, or the keyboard closing.

## `onContentSizeChange`

`(e: ContentSizeEvent) => void`. The view size at which nothing scrolls, `contentInsets` included, in dp. Sent after a draw whose content size changed, at most once per frame, and the first time before `onReady`. With soft wrap the value converges over a few frames as lines are measured. The keyboard overlap from `avoidKeyboard` is not included. See [nested in a ScrollView](/guides/nested-scroll/).
