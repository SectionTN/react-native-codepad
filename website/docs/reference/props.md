---
title: Props
description: Every prop of CodeEditor with its type, its default and what it does.
sidebar_position: 1
---

`CodeEditor` takes every React Native `ViewProps` plus the props below. `style` sizes the editor like any other view. Style padding is ignored, `contentInsets` is the padding instead. The callbacks are on the [events page](/reference/events/).

## Document

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `initialValue` | `string` | `''` | Sets the initial text of the editor. It is read once, so use `setText()` to replace the document later. |
| `language` | `string` | undefined | The id of an installed [language package](/reference/languages/). Without the package the editor shows plain text. |
| `readOnly` | `boolean` | `false` | Makes the editor read only: no keyboard, and the toolbar methods that type or delete do nothing. Selection, copy and search still work. |

## Appearance

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `theme` | `Theme` | `githubLight` | The colors. Hoist the object, it is compared by identity. See [theme tokens](/reference/theme-tokens/). |
| `fontFamily` | `string` | `monospace` on Android, `Menlo` on iOS | The font, by name. Fonts linked with react-native-asset or expo-font resolve by name. |
| `fontSize` | `number` | `14` | In dp on Android and points on iOS. |
| `lineHeight` | `number` | `1.4` | A multiplier of the font size. The row height is `round(fontSize * lineHeight)`. |
| `lineNumbers` | `boolean` | `true` | Shows the line number gutter. |
| `softWrap` | `boolean` | `false` | Wraps long lines. Off means horizontal scrolling. |
| `highlightActiveLine` | `boolean` | `true` | Paints the line the caret is on. |
| `matchBrackets` | `boolean` | `true` | Paints the bracket pair at the caret. Brackets inside strings and comments are skipped. |
| `placeholder` | `string` | undefined | Text drawn while the document is empty. |

## Editing

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `tabSize` | `number` | `4` | The width of one indentation level. |
| `insertSpaces` | `boolean` | `true` | Indents with spaces. Off indents with tabs. |
| `autoIndent` | `boolean` | `true` | A newline keeps the indentation of the line above and adds a level inside an open bracket. |
| `autoCloseBrackets` | `boolean` | `true` | Closes pairs as you type, skips over a closer you type yourself, wraps a selection, and removes an empty pair on Backspace. |
| `suggestions` | `Suggestions` | `'off'` | What the keyboard offers: `off` asks for none, `forceOff` also kills composition on most Android keyboards, `on` allows autocorrect. On iOS `forceOff` is the same as `off`. |
| `autoFocus` | `boolean` | `false` | Focuses the editor and shows the keyboard once the view is attached. |

## Scrolling and keyboard

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `scrollEnabled` | `boolean` | `true` | Off lets a parent `ScrollView` scroll through the editor. |
| `contentInsets` | `ContentInsets` | all 0 | The padding inside the scrollable area, in dp on Android and points on iOS. A bottom inset keeps the caret above a toolbar. |
| `avoidKeyboard` | `boolean` | `false` | Adds the keyboard overlap to the bottom inset on every frame of the keyboard animation. See the [keyboard guide](/guides/keyboard/). |
