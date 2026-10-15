---
title: Themes
description: The three built-in themes, the Theme shape and how to write your own.
sidebar_position: 2
---

CodePad ships with 3 themes: `githubLight` (the default), `githubDark` and `oneDark`. Each one is a plain object passed as `theme`.

```tsx
import { useColorScheme } from 'react-native';
import { CodeEditor, githubDark, githubLight } from 'react-native-codepad';

export function Editor() {
  const scheme = useColorScheme();
  return <CodeEditor style={{ flex: 1 }} theme={scheme === 'dark' ? githubDark : githubLight} />;
}
```

## The shape

```ts
interface Theme {
  background: string;
  foreground: string;
  gutterBackground: string;
  gutterForeground: string;
  gutterActiveForeground: string;
  activeLine: string;
  selection: string;
  cursor: string;
  matchingBracket: string;
  searchMatch: string;
  searchMatchActive: string;
  tokens: Record<string, TokenStyle>;
}

type TokenStyle = string | { color: string; bold?: boolean; italic?: boolean };
```

Colors are `#rrggbb` or `#rrggbbaa`. `selection`, `matchingBracket`, `searchMatch` and `searchMatchActive` are drawn under the text, so give them some alpha. The [theme tokens reference](/reference/theme-tokens/) lists every value of the three themes.

## Token lookup

`tokens` is keyed by tree-sitter capture names such as `keyword`, `keyword.return`, `punctuation.bracket` or `markup.heading.1`. The lookup walks the dotted prefixes from the longest one down and ends at `foreground`, so a theme only needs the root names and can add a leaf wherever it wants a distinction.

The built-in themes cover every capture the fifteen packages produce. A theme from the nvim-treesitter ecosystem ports by renaming its keys: `@keyword.return` becomes `keyword.return`.

## A custom theme

Spread a built-in theme and override what you want:

```ts
import { githubDark, type Theme } from 'react-native-codepad';

export const midnight: Theme = {
  ...githubDark,
  background: '#000000',
  gutterBackground: '#000000',
  tokens: {
    ...githubDark.tokens,
    keyword: { color: '#ff9bce', bold: true },
    'string.regexp': '#ffd27f',
    comment: { color: '#6b7280', italic: true },
  },
};
```

Hoist the object out of the render. The prop is compared by identity, so a literal written in JSX crosses to native on every render.

A theme built from scratch needs the root names: `comment`, `keyword`, `string`, `number`, `function`, `variable`, `type`, `operator`, `punctuation`, `tag`, `attribute`, `constant`, `boolean`, `property`, `module`, `label`, `constructor`, `character` and the `markup.*` keys. A missing root paints in `foreground`.

Bold and italic need a font that has those faces. The defaults, `monospace` on Android and `Menlo` on iOS, do.
