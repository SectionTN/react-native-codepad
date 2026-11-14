---
title: Props
description: Every prop of CodeEditor with its type, its default and what it does.
sidebar_position: 1
---

`CodeEditor` takes every React Native `ViewProps` plus the props in the following tables. `style` sizes the editor as it sizes any other view. The editor ignores padding in `style`, and `contentInsets` is the padding instead. The callbacks are on the [events page](/reference/events/).

## Document

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `initialValue` | `string` | `''` | Sets the initial text of the editor. It is read once, so use `setText()` to replace the document later. |
| `language` | `string` | undefined | The id of an installed [language package](/reference/languages/). Without the package the editor shows plain text. |
| `readOnly` | `boolean` | `false` | Makes the editor read only: no keyboard, and the toolbar methods that type or delete do nothing. Selection, copy and search still work. |

## Appearance

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `theme` | `Theme` | `githubLight` | Sets the editor's colors. The prop is compared by reference, so define the object outside your component. See [theme tokens](/reference/theme-tokens/). |
| `fontFamily` | `string` | `monospace` on Android, `Menlo` on iOS | The font, by the name React Native's `Text` takes: an `expo-font` key such as `JetBrainsMono_400Regular`, a font linked with `react-native-asset` or a system family. iOS also takes a PostScript name. Load the font before the editor mounts. With an unknown name or a font that loads later, the editor draws the default. |
| `fontSize` | `number` | `14` | Sets the font size, in dp on Android and points on iOS. |
| `lineHeight` | `number` | `1.4` | Sets the line height as a multiple of `fontSize`. The row height is `round(fontSize * lineHeight)`. |
| `lineNumbers` | `boolean` | `true` | Shows the line number gutter. |
| `softWrap` | `boolean` | `false` | Wraps long lines to the editor's width. When it's off, long lines scroll sideways. |
| `highlightActiveLine` | `boolean` | `true` | Paints the line the caret is on. |
| `matchBrackets` | `boolean` | `true` | Paints the bracket pair at the caret. Brackets inside strings and comments are skipped. |
| `placeholder` | `string` | undefined | Shows this text while the document is empty. |

## Editing

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `tabSize` | `number` | `4` | The width of one indentation level. |
| `insertSpaces` | `boolean` | `true` | Indents with spaces. When it's off, the editor indents with tabs. |
| `autoIndent` | `boolean` | `true` | A newline keeps the indentation of the line before it and adds a level inside an open bracket. |
| `autoCloseBrackets` | `boolean` | `true` | Closes pairs as you type, skips over a closer you type yourself, wraps a selection, and removes an empty pair on Backspace. |
| `suggestions` | `Suggestions` | `'off'` | Controls what the keyboard offers. `off` asks for no suggestions. `forceOff` also makes most Android keyboards type each letter straight in, without an underlined word in progress. `on` allows suggestions and autocorrect. On iOS, `forceOff` is the same as `off`. |
| `autoFocus` | `boolean` | `false` | Focuses the editor and opens the keyboard when the editor first appears. |

## Scrolling and keyboard

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `scrollEnabled` | `boolean` | `true` | Lets the editor scroll up and down. When it's off, vertical drags go to a parent `ScrollView`, and lines wider than the editor still scroll sideways. |
| `contentInsets` | `ContentInsets` | All 0 | Adds space inside the scrollable area, in dp on Android and points on iOS. A bottom inset keeps the caret above a toolbar. |
| `textPadding` | `number` | `8` | The space between the text and the editor's left and right edges, inside `contentInsets`, in dp on Android and points on iOS. Set it to `0` to start the text exactly at `contentInsets.left`. |
| `avoidKeyboard` | `boolean` | `false` | Adds the keyboard overlap to the bottom inset on every frame of the keyboard animation. See the [keyboard guide](/guides/keyboard/). |

## Decorations

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `decorations` | `Decoration[]` | undefined | Draws underlines, gaps under lines and line backgrounds. They follow edits until the next array arrives. See the [decorations guide](/guides/decorations/). |
| `decorationsRevision` | `number` | undefined | Gives the revision of the text the array was computed for, from `getRevision()` or `ChangeEvent.revision`. The editor moves the array through the edits made since then. Without it, the editor takes the array as computed for the current text. |
