---
title: Props
description: Every prop of CodeEditor with its type, default and semantics.
sidebar:
  order: 1
---

`CodeEditor` accepts every React Native `ViewProps` (`style` sizes it like any view) plus the props below. Style padding on the view is ignored: `contentInsets` is the only padding mechanism. Callbacks are on the [events page](/react-native-codepad/reference/events/).

## Document

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `initialValue` | `string` | `''` | Read once at mount, later changes are ignored; use `setText()`. Loading emits no event and leaves the revision at 0. |
| `language` | `string` | undefined | A grammar name from an installed [language package](/react-native-codepad/reference/languages/). Plain text when undefined or not installed, with one warning in the log. |
| `readOnly` | `boolean` | `false` | Selection, copy and search keep working, no keyboard shows, and `typeText()`, `deleteBackward()` and `deleteForward()` do nothing. |

## Appearance

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `theme` | `Theme` | `githubLight` | See [theme tokens](/react-native-codepad/reference/theme-tokens/). Hoist the object: a new literal on every render crosses to native each time. |
| `fontFamily` | `string` | `monospace` on Android, `Menlo` on iOS | Fonts linked with react-native-asset or expo-font resolve by name. |
| `fontSize` | `number` | `14` | dp on Android, points on iOS. |
| `lineHeight` | `number` | `1.4` | A multiplier; the row height is `round(fontSize * lineHeight)`. |
| `lineNumbers` | `boolean` | `true` | |
| `softWrap` | `boolean` | `false` | Off means horizontal scrolling. |
| `highlightActiveLine` | `boolean` | `true` | |
| `matchBrackets` | `boolean` | `true` | Paints the bracket pair at the caret, skipping brackets inside strings and comments. |
| `placeholder` | `string` | undefined | Drawn in the gutter foreground color while the document is empty. |

## Editing

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `tabSize` | `number` | `4` | |
| `insertSpaces` | `boolean` | `true` | |
| `autoIndent` | `boolean` | `true` | A newline copies the indentation of the line and adds one level inside an open bracket. |
| `autoCloseBrackets` | `boolean` | `true` | Brackets and quotes close as you type, a closer typed before the pending one skips it, a selection gets wrapped, and a backspace inside an empty pair removes both. |
| `suggestions` | `Suggestions` | `'off'` | `off` disables keyboard suggestions, `forceOff` also kills composition on most keyboards, `on` allows autocorrect. |
| `autoFocus` | `boolean` | `false` | Focus and show the keyboard once the view is attached. |

## Scrolling and keyboard

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `scrollEnabled` | `boolean` | `true` | With `false` the view never claims touch scrolling, so a parent ScrollView scrolls through it. |
| `contentInsets` | `ContentInsets` | all 0 | Padding inside the scrollable area, in dp. The bottom inset is how a toolbar keeps the caret visible. |
| `avoidKeyboard` | `boolean` | `false` | The view follows the window's keyboard insets itself and adds the overlap with its bounds to the bottom inset on every animation frame. `onContentSizeChange` excludes that overlap, and under `adjustPan` the view does nothing because the window moves instead. Android today, iOS when the Swift editor lands. See the [keyboard guide](/react-native-codepad/guides/keyboard/). |
