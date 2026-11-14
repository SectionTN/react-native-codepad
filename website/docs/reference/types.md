---
title: Types
description: The TypeScript types the package exports.
sidebar_position: 4
---

`react-native-codepad` exports the types below. Offsets count UTF-16 code units. Lines and columns start at 0, and a range includes its start but excludes its end. Sizes and positions are in dp on Android and points on iOS.

| Type | Shape | Notes |
| --- | --- | --- |
| `Range` | `{ start: number; end: number }` | The range includes `start` and excludes `end`. |
| `Selection` | `{ anchor: number; head: number }` | `anchor` is the fixed end of the selection, and `head` is the caret. |
| `Position` | `{ line: number; column: number }` | A line and a column, both counted from 0. |
| `Rect` | `{ x: number; y: number; width: number; height: number }` | A rectangle in the editor view's own coordinates. |
| `ContentInsets` | `{ top?: number; bottom?: number; left?: number; right?: number }` | The space inside the scrollable area on each side. |
| `ScrollEvent` | `{ x: number; y: number; contentWidth: number; contentHeight: number }` | The scroll offset and the content size, without the insets. |
| `SelectionChangeEvent` | `Selection & { revision: number }` | The selection and the revision of the text it belongs to. |
| `ChangeOrigin` | `'input' \| 'api' \| 'undo' \| 'redo'` | Where a change came from. |
| `ChangeEvent` | `{ start: number; end: number; text: string; origin: ChangeOrigin; revision: number }` | The text from `start` to `end` was replaced with `text`. |
| `ContentSizeEvent` | `{ width: number; height: number }` | The size at which nothing scrolls, insets included. |
| `CaretDirection` | `'left' \| 'right' \| 'wordLeft' \| 'wordRight' \| 'lineStart' \| 'lineEnd' \| 'documentStart' \| 'documentEnd' \| 'up' \| 'down' \| 'pageUp' \| 'pageDown'` | The directions `moveCaret()` takes. |
| `Suggestions` | `'off' \| 'forceOff' \| 'on'` | The values of the `suggestions` prop. |
| `SearchQuery` | `{ text: string; regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean }` | Regular expressions behave the same on both platforms. The replacement text is used as is, with no `$1` groups. |
| `SearchHit` | `{ index: number; total: number }` | `index` is the position of the selected match, counted from 0, out of `total` matches. |
| `Decoration` | `{ kind: 'underline'; range: Range; color: string; style?: 'solid' \| 'wavy'; thickness?: number; offset?: number } \| { kind: 'gap'; line: number; rows: number } \| { kind: 'lineBackground'; line: number; color: string }` | One item of the `decorations` prop. An underline is solid, 1 dp thick and 2 dp below the baseline by default. A gap is `rows` rows tall under its line. |
| `GapLayoutEvent` | `{ gaps: { line: number; rect: Rect }[] }` | Every gap with its rectangle, sorted by line. |
| `TokenStyle` | `string \| { color: string; bold?: boolean; italic?: boolean }` | A color string is the short form of `{ color }`. |
| `Theme` | See [theme tokens](/reference/theme-tokens/). | |
| `CodeEditorProps` | See [props](/reference/props/). | It extends React Native `ViewProps`. |
| `CodeEditorRef` | See [methods](/reference/methods/). | |

Colors take `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`. A theme color that doesn't parse paints magenta on Android and logs a warning. On iOS an editor color that doesn't parse takes the matching `githubLight` color, a token color takes the `githubLight` text color, and nothing is logged. A decoration whose color doesn't parse is dropped on both platforms.

The `Codepad` object has one method, `availableLanguages(): string[]`, which returns the language ids installed in the app.
