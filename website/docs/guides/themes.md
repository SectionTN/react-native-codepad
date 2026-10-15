---
title: Themes
description: The three shipped themes, the Theme shape and how to write your own.
sidebar_position: 2
---

A theme is a plain object passed as the `theme` prop. Three ship with the library: `githubLight` (the default) and `githubDark` from Primer's syntax palette, and `oneDark` from Atom. Pick one per color scheme:

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

Colors are hex strings, `#rrggbb` or `#rrggbbaa`. `selection`, `matchingBracket`, `searchMatch` and `searchMatchActive` are fills drawn under the text, so give them alpha. The [theme tokens reference](/reference/theme-tokens/) lists every value of the three themes side by side.

## Token lookup

`tokens` is keyed by tree-sitter capture names, the dotted names the highlight queries produce: `keyword`, `keyword.return`, `punctuation.bracket`, `markup.heading.1`. Lookup walks the dotted prefixes from the longest: `keyword.return` paints with `keyword.return` when the theme defines it, else `keyword`, else `foreground`. A theme therefore needs only the roots to color everything, and adds leaves where it wants a distinction.

The shipped themes define a few dozen keys and cover every capture name the fifteen packages produce; a test in the repository keeps them complete and in step with each other. The [language packages reference](/reference/languages/) lists the names per grammar, which is the list to look at when a token does not get the color you expect.

Themes from the nvim-treesitter ecosystem port by renaming: their `@keyword.return` is our `keyword.return`.

## A custom theme

Start from a shipped theme and override:

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

Two rules:

- Hoist the object. The prop is compared by identity before it crosses to native, so a literal in JSX would send the whole token map on every render.
- Keep the roots. A theme built from scratch rather than spread from a shipped one should define at least `comment`, `keyword`, `string`, `number`, `function`, `variable`, `type`, `operator`, `punctuation`, `tag`, `attribute`, `constant`, `boolean`, `property`, `module`, `label`, `constructor`, `character` and the `markup.*` keys, or the tokens under them paint in `foreground`.

Bold and italic need a font with those faces; the defaults, `monospace` on Android and `Menlo` on iOS, have them.
