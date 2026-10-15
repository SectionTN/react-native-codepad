---
title: Types
description: The TypeScript types the package exports.
sidebar_position: 4
---

All of these are exported from `react-native-codepad`. Offsets count UTF-16 code units, lines and columns start at 0, and ranges include the start but exclude the end.

| Type | Shape | Notes |
| --- | --- | --- |
| `Range` | `{ start: number; end: number }` | `[start, end)` |
| `Selection` | `{ anchor: number; head: number }` | `head` is the caret. |
| `Position` | `{ line: number; column: number }` | A line and a column. |
| `Rect` | `{ x: number; y: number; width: number; height: number }` | View coordinates, in dp. |
| `ContentInsets` | `{ top?: number; bottom?: number; left?: number; right?: number }` | In dp. |
| `ScrollEvent` | `{ x: number; y: number; contentWidth: number; contentHeight: number }` | In dp, without insets. |
| `SelectionChangeEvent` | `Selection & { revision: number }` | The selection plus its revision. |
| `ChangeOrigin` | `'input' \| 'api' \| 'undo' \| 'redo'` | Where a change came from. |
| `ChangeEvent` | `{ start: number; end: number; text: string; origin: ChangeOrigin; revision: number }` | `[start, end)` was replaced with `text`. |
| `ContentSizeEvent` | `{ width: number; height: number }` | The size at which nothing scrolls, insets included, in dp. |
| `CaretDirection` | `'left' \| 'right' \| 'wordLeft' \| 'wordRight' \| 'lineStart' \| 'lineEnd' \| 'documentStart' \| 'documentEnd' \| 'up' \| 'down' \| 'pageUp' \| 'pageDown'` | For `moveCaret()`. |
| `Suggestions` | `'off' \| 'forceOff' \| 'on'` | For the `suggestions` prop. |
| `SearchQuery` | `{ text: string; regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean }` | ICU regex on both platforms. The replacement text is literal. |
| `SearchHit` | `{ index: number; total: number }` | The 0 based index of the selected match. |
| `TokenStyle` | `string \| { color: string; bold?: boolean; italic?: boolean }` | A color string is the shorthand. |
| `Theme` | see [theme tokens](/reference/theme-tokens/) | |
| `CodeEditorProps` | see [props](/reference/props/) | Extends React Native `ViewProps`. |
| `CodeEditorRef` | see [methods](/reference/methods/) | |

Colors accept `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`. Anything else paints magenta and logs a warning.

The module object `Codepad` has one method, `availableLanguages(): string[]`, which lists the grammar names installed in the app.
