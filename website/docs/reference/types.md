---
title: Types
description: The exported TypeScript types.
sidebar_position: 4
---

All exported from `react-native-codepad`. Offsets are UTF-16 code units, lines and columns are 0 based, ranges are half open.

| Type | Shape | Notes |
| --- | --- | --- |
| `Range` | `{ start: number; end: number }` | `[start, end)` |
| `Selection` | `{ anchor: number; head: number }` | `head` is the caret. |
| `Position` | `{ line: number; column: number }` | |
| `Rect` | `{ x: number; y: number; width: number; height: number }` | View coordinates in dp. |
| `ContentInsets` | `{ top?: number; bottom?: number; left?: number; right?: number }` | dp |
| `ScrollEvent` | `{ x: number; y: number; contentWidth: number; contentHeight: number }` | dp, bare content extent. |
| `SelectionChangeEvent` | `Selection & { revision: number }` | |
| `ChangeOrigin` | `'input' \| 'api' \| 'undo' \| 'redo'` | |
| `ChangeEvent` | `{ start: number; end: number; text: string; origin: ChangeOrigin; revision: number }` | `[start, end)` was replaced with `text`. |
| `ContentSizeEvent` | `{ width: number; height: number }` | The view size at which nothing scrolls, insets included, dp. |
| `CaretDirection` | `'left' \| 'right' \| 'wordLeft' \| 'wordRight' \| 'lineStart' \| 'lineEnd' \| 'documentStart' \| 'documentEnd' \| 'up' \| 'down' \| 'pageUp' \| 'pageDown'` | For `moveCaret()`. |
| `Suggestions` | `'off' \| 'forceOff' \| 'on'` | For the `suggestions` prop. |
| `SearchQuery` | `{ text: string; regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean }` | `text` is a regular expression when `regex` is set, ICU's dialect on both platforms (see the [search guide](/guides/search/)); replacement text is always literal. |
| `SearchHit` | `{ index: number; total: number }` | 1 based index of the selected match. |
| `TokenStyle` | `string \| { color: string; bold?: boolean; italic?: boolean }` | A color string is the shorthand. |
| `Theme` | see [theme tokens](/reference/theme-tokens/) | |
| `CodeEditorProps` | see [props](/reference/props/) | Extends React Native `ViewProps`. |
| `CodeEditorRef` | see [methods](/reference/methods/) | |

Colors accept `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`; anything else paints magenta and logs a warning.

The module object `Codepad` has one method, `availableLanguages(): string[]`, which lists the grammar names installed in the app.
