---
title: Themes
description: The three shipped themes, the Theme shape and your own.
sidebar_position: 2
---

A theme is a plain object passed as `theme`. Three ship: `githubLight` (the default), `githubDark` and `oneDark`.

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

Colors are `#rrggbb` or `#rrggbbaa`. `selection`, `matchingBracket`, `searchMatch` and `searchMatchActive` are drawn under the text: give them alpha. The [theme tokens reference](/reference/theme-tokens/) lists every value of the three themes.

## Token lookup

`tokens` is keyed by tree-sitter capture names: `keyword`, `keyword.return`, `punctuation.bracket`, `markup.heading.1`. Lookup walks the dotted prefixes from the longest, then falls back to `foreground`, so a theme needs only the roots and adds leaves where it wants a distinction.

The shipped themes cover every capture the fifteen packages produce. A theme from the nvim-treesitter ecosystem ports by renaming: `@keyword.return` becomes `keyword.return`.

## A custom theme

Spread a shipped theme and override:

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

- Hoist the object. The prop is compared by identity, so a literal in JSX crosses to native on every render.
- A theme built from scratch needs the roots: `comment`, `keyword`, `string`, `number`, `function`, `variable`, `type`, `operator`, `punctuation`, `tag`, `attribute`, `constant`, `boolean`, `property`, `module`, `label`, `constructor`, `character` and the `markup.*` keys. Missing roots paint in `foreground`.

Bold and italic need a font with those faces. The defaults, `monospace` on Android and `Menlo` on iOS, have them.
