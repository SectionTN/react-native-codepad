---
title: Themes
description: The three built-in themes, the Theme object and how to write your own.
sidebar_position: 2
---

CodePad ships with three themes: `githubLight` (the default), `githubDark` and `oneDark`. Each one is a plain object passed as `theme`.

```tsx title="Editor.tsx"
import { useColorScheme } from 'react-native';
import { CodeEditor, githubDark, githubLight } from 'react-native-codepad';

export function Editor() {
  const scheme = useColorScheme();
  return <CodeEditor style={{ flex: 1 }} theme={scheme === 'dark' ? githubDark : githubLight} />;
}
```

## The theme object

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

Colors take `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`. The editor draws `selection`, `matchingBracket`, `searchMatch` and `searchMatchActive` under the text, and the selection over the search matches. Give the selection some transparency, such as `#0969da33`, so a search match still shows through it. The [theme tokens reference](/reference/theme-tokens/) lists every value of the three themes.

## Token colors

The highlighter gives each piece of code a name, such as `keyword`, `keyword.return`, `punctuation.bracket` or `markup.heading.1`. `tokens` maps those names to colors. When a name has no entry, the editor drops its last part and tries again, so `keyword.return` falls back to `keyword`. A name with no match at all paints in `foreground`. A theme only needs the short root names, and it can add a longer name wherever it wants a different color.

The built-in themes have a color for every name the nineteen language packages produce. To reuse a Neovim theme, drop the `@` from its keys: `@keyword.return` becomes `keyword.return`.

## A custom theme

Spread a built-in theme and override what you want:

```ts title="midnight.ts"
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

Define the theme outside your component. The editor compares the `theme` prop by reference, so an object written inline in JSX is sent to the native editor again on every render.

A theme built from scratch needs the root names: `comment`, `keyword`, `string`, `number`, `function`, `variable`, `type`, `operator`, `punctuation`, `tag`, `attribute`, `constant`, `boolean`, `property`, `module`, `label`, `constructor`, `character` and the `markup.*` keys. Code with a missing root name paints in `foreground`.

A color that doesn't parse paints magenta on Android and logs a warning. On iOS an editor color that doesn't parse takes the matching `githubLight` color, and a token color takes the `githubLight` text color, which is hard to read on a dark background. iOS doesn't log a warning, so check a new theme on both platforms.

Bold and italic need a font that has those styles. The default fonts, `monospace` on Android and `Menlo` on iOS, have them.
