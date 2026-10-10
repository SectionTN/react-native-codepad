---
title: Theme tokens
description: The Theme shape, the shipped themes and how token keys resolve.
sidebar:
  order: 5
---

A `Theme` is a plain object: eleven editor colors plus `tokens`, a map from tree-sitter capture names to a `TokenStyle`. Three themes ship: `githubLight` (the default), `githubDark` and `oneDark`.

## Editor colors

| Key | githubLight | githubDark | oneDark |
| --- | --- | --- | --- |
| `background` | #ffffff | #0d1117 | #282c34 |
| `foreground` | #1f2328 | #e6edf3 | #abb2bf |
| `gutterBackground` | #ffffff | #0d1117 | #282c34 |
| `gutterForeground` | #8c959f | #6e7681 | #4b5263 |
| `gutterActiveForeground` | #1f2328 | #e6edf3 | #abb2bf |
| `activeLine` | #f6f8fa | #161b22 | #2c313c |
| `selection` | #0969da33 | #388bfd66 | #3e4451 |
| `cursor` | #1f2328 | #e6edf3 | #528bff |
| `matchingBracket` | #1f232833 | #3fb95059 | #3e445199 |
| `searchMatch` | #ffd33d66 | #9e6a0366 | #e5c07b55 |
| `searchMatchActive` | #ffb70099 | #d2992299 | #e5c07b99 |

`selection`, `matchingBracket`, `searchMatch` and `searchMatchActive` are fills drawn under the text, so they carry alpha. `cursor` colors the caret and the selection handles on both platforms: Android tints the platform handles with it, iOS draws its own knob and bar in it and hands it to the system loupe as the tint. Every other color applies the same on both platforms.

## Token keys

Keys are the capture names the highlight queries produce, such as `keyword.return` or `punctuation.bracket`. Lookup takes the longest dotted prefix the theme defines: `keyword.return` falls back to `keyword`, and a name with no prefix in the theme paints in `foreground`. The [language packages page](/react-native-codepad/reference/languages/) lists the names each grammar produces; the shipped themes cover all of them, and a test in the repository keeps it that way.

| Key | githubLight | githubDark | oneDark |
| --- | --- | --- | --- |
| `attribute` | #0550ae | #79c0ff | #d19a66 |
| `boolean` | #0550ae | #79c0ff | #d19a66 |
| `character` | #0a3069 | #a5d6ff | #98c379 |
| `comment` | #59636e italic | #8b949e italic | #5c6370 italic |
| `constant` | #0550ae | #79c0ff | #d19a66 |
| `constant.builtin` | #0550ae | #79c0ff | #d19a66 |
| `constructor` | #8250df | #d2a8ff | #61afef |
| `function` | #8250df | #d2a8ff | #61afef |
| `function.builtin` | #8250df | #d2a8ff | #61afef |
| `function.call` | #8250df | #d2a8ff | #61afef |
| `function.method` | #8250df | #d2a8ff | #61afef |
| `keyword` | #cf222e | #ff7b72 | #c678dd |
| `keyword.function` | #cf222e | #ff7b72 | #c678dd |
| `keyword.operator` | #cf222e | #ff7b72 | #c678dd |
| `keyword.return` | #cf222e | #ff7b72 | #c678dd |
| `label` | #cf222e | #ffa657 | #e5c07b |
| `markup.heading` | #0550ae bold | #79c0ff bold | #e06c75 bold |
| `markup.italic` | #1f2328 italic | #e6edf3 italic | #abb2bf italic |
| `markup.link` | #0a3069 | #a5d6ff | #61afef |
| `markup.list` | #59636e | #8b949e | #5c6370 |
| `markup.quote` | #59636e italic | #8b949e italic | #5c6370 italic |
| `markup.raw` | #0a3069 | #a5d6ff | #98c379 |
| `markup.strikethrough` | #1f2328 | #e6edf3 | #abb2bf |
| `markup.strong` | #1f2328 bold | #e6edf3 bold | #abb2bf bold |
| `markup.underline` | #1f2328 | #e6edf3 | #abb2bf |
| `module` | #953800 | #ffa657 | #e5c07b |
| `number` | #0550ae | #79c0ff | #d19a66 |
| `operator` | #cf222e | #ff7b72 | #56b6c2 |
| `property` | #0550ae | #79c0ff | #e06c75 |
| `punctuation` | #1f2328 | #e6edf3 | #abb2bf |
| `punctuation.bracket` | #1f2328 | #e6edf3 | #abb2bf |
| `punctuation.delimiter` | #1f2328 | #e6edf3 | #abb2bf |
| `string` | #0a3069 | #a5d6ff | #98c379 |
| `string.escape` | #0a3069 | #a5d6ff | #56b6c2 |
| `string.special` | #0a3069 | #a5d6ff | #98c379 |
| `tag` | #116329 | #7ee787 | #e06c75 |
| `tag.attribute` | #0550ae | #79c0ff | #d19a66 |
| `type` | #953800 | #ffa657 | #e5c07b |
| `type.builtin` | #953800 | #ffa657 | #e5c07b |
| `variable` | #1f2328 | #e6edf3 | #abb2bf |
| `variable.builtin` | #cf222e | #ffa657 | #e5c07b |
| `variable.member` | #0550ae | #79c0ff | #e06c75 |
| `variable.parameter` | #1f2328 | #e6edf3 | #e06c75 |

## A custom theme

Start from a shipped theme and override what you need. A `TokenStyle` is a color string or `{ color, bold?, italic? }`.

```ts
import { githubDark, type Theme } from "react-native-codepad";

export const midnight: Theme = {
  ...githubDark,
  background: "#000000",
  tokens: {
    ...githubDark.tokens,
    keyword: { color: "#ff9bce", bold: true },
    "string.regexp": "#ffd27f",
  },
};
```

Hoist the object outside the component: the prop is compared by identity before it crosses to native.
