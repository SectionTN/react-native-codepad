---
title: Props
description: Every prop of CodeEditor with its type, default and what it does.
sidebar_position: 1
---

`CodeEditor` takes every React Native `ViewProps` plus the props below. `style` sizes it like any view; style padding is ignored, `contentInsets` is the padding. Callbacks are on the [events page](/reference/events/).

## Document

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `initialValue` | `string` | `''` | Read once. Replace the document with `setText()`. |
| `language` | `string` | undefined | A grammar id from an installed [language package](/reference/languages/). Plain text otherwise, with one warning. |
| `readOnly` | `boolean` | `false` | No keyboard. Selection, copy and search still work; `typeText()`, `deleteBackward()` and `deleteForward()` do nothing. |

## Appearance

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `theme` | `Theme` | `githubLight` | Hoist the object: it is compared by identity. See [theme tokens](/reference/theme-tokens/). |
| `fontFamily` | `string` | `monospace` on Android, `Menlo` on iOS | Fonts linked with react-native-asset or expo-font resolve by name. |
| `fontSize` | `number` | `14` | dp on Android, points on iOS. |
| `lineHeight` | `number` | `1.4` | A multiplier. The row height is `round(fontSize * lineHeight)`. |
| `lineNumbers` | `boolean` | `true` | |
| `softWrap` | `boolean` | `false` | Off means horizontal scrolling. |
| `highlightActiveLine` | `boolean` | `true` | |
| `matchBrackets` | `boolean` | `true` | Paints the pair at the caret. Brackets inside strings and comments are skipped. |
| `placeholder` | `string` | undefined | Drawn while the document is empty. |

## Editing

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `tabSize` | `number` | `4` | |
| `insertSpaces` | `boolean` | `true` | |
| `autoIndent` | `boolean` | `true` | A newline keeps the indentation and adds a level inside an open bracket. |
| `autoCloseBrackets` | `boolean` | `true` | Pairs close as you type, a typed closer skips the pending one, a selection gets wrapped, Backspace removes an empty pair. |
| `suggestions` | `Suggestions` | `'off'` | `off` asks the keyboard for none, `forceOff` also kills composition on most Android keyboards, `on` allows autocorrect. On iOS `forceOff` equals `off`. |
| `autoFocus` | `boolean` | `false` | Focus and show the keyboard once the view is attached. |

## Scrolling and keyboard

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `scrollEnabled` | `boolean` | `true` | `false` lets a parent ScrollView scroll through the editor. |
| `contentInsets` | `ContentInsets` | all 0 | The padding, inside the scrollable area, in dp on Android and points on iOS. The bottom inset keeps the caret above a toolbar. |
| `avoidKeyboard` | `boolean` | `false` | Adds the keyboard overlap to the bottom inset on every frame of the keyboard animation. See the [keyboard guide](/guides/keyboard/). |
