---
title: Events
description: The callback props, their payloads and when they fire.
sidebar_position: 2
---

Every callback is wrapped once by the component, so an inline arrow function is fine. Payload types are on the [types page](/reference/types/).

## `onReady`

`() => void`. Once, after the first draw with `initialValue` applied. Ref methods are valid from here; earlier calls operate on an empty document.

## `onChange`

`(e: ChangeEvent) => void`. One event per committed change, composition updates included, as a delta: `[start, end)` was replaced with `text`. `revision` grows by one per change. `origin` is `input` for the keyboard, the edit menu and the toolbar methods, `api` for `setText()`, `replaceRange()` and `insertText()`, `undo` or `redo` for history.

## `onChangeText`

`(text: string) => void`. The full document after every change, at the cost of a copy per edit. Prefer `onChange` on large documents.

## `onSelectionChange`

`(s: SelectionChangeEvent) => void`. Anchor and head in UTF-16 units plus their revision. One event per frame at most.

## `onScroll`

`(e: ScrollEvent) => void`. The scroll offset and the content extent in dp, without insets. One event per frame at most.

## `onFocus` and `onBlur`

`() => void`. Focus follows the native view: a tap, `focus()`, `blur()`, the keyboard closing.

## `onContentSizeChange`

`(e: ContentSizeEvent) => void`. The view size at which nothing scrolls, `contentInsets` included, in dp. Sent after a draw whose content size changed, at most once per frame, the first time before `onReady`. With soft wrap the value converges over a few frames as lines measure. The keyboard overlap from `avoidKeyboard` is not included. See [nested in a ScrollView](/guides/nested-scroll/).
