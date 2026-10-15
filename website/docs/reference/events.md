---
title: Events
description: The callback props, their payloads and when they fire.
sidebar_position: 2
---

Every callback is wrapped once by the component and reads the latest handler, so an inline arrow function is fine. Payload types are on the [types page](/reference/types/).

## `onReady`

`() => void`. Fires once, after the first draw with `initialValue` applied. Ref methods are valid from that point; calling them earlier is safe and operates on an empty document.

## `onChange`

`(e: ChangeEvent) => void`. One event per committed change, including every keyboard composition update, always as a delta: `[start, end)` was replaced with `text`. `revision` grows by one per change. `origin` says where the change came from: `input` for the keyboard, hardware keys, the edit menu and the toolbar methods, `api` for `setText()`, `replaceRange()` and `insertText()`, `undo` and `redo` for history.

## `onChangeText`

`(text: string) => void`. Opt in: the full document after every change, which costs a copy of the text per edit and crosses the bridge as UTF-8. Prefer `onChange` deltas on large documents. Native only sends it while the prop is set.

## `onSelectionChange`

`(s: SelectionChangeEvent) => void`. The anchor and head in UTF-16 units plus the revision they belong to. Coalesced to one event per frame.

## `onScroll`

`(e: ScrollEvent) => void`. The scroll offset and the bare content extent in dp, without insets. Coalesced to one event per frame.

## `onFocus` and `onBlur`

`() => void`. Focus follows the native view: a tap, `focus()`, `blur()`, or the keyboard closing through the system back gesture.

## `onContentSizeChange`

`(e: ContentSizeEvent) => void`. The view size at which nothing scrolls, `contentInsets` included and in dp, sent after a draw whose content size differs from the last one reported, at most once per frame, the first time before `onReady`. With soft wrap on, an unmeasured line counts as one row and the value converges as lines measure, so a view sized from it grows over a few frames. The keyboard overlap added by `avoidKeyboard` is not included. See [nested in a ScrollView](/guides/nested-scroll/).
