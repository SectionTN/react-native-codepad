---
title: Introduction
description: What react-native-codepad is and what it ships.
sidebar_position: 1
---

react-native-codepad is a code editor for React Native with its own engine on each platform: Kotlin on Android, Swift on iOS. Highlighting is tree-sitter, one language per npm package. The view is bound through Nitro, so props, events and ref methods cross without a bridge round trip.

No WebView, no `TextInput`. The view draws its own caret, selection handles and edit menu.

:::note[Pre-release]
The packages are not on npm yet. `0.1.0` is the first release; the [roadmap](/internals/roadmap/) says what is in it.
:::

## What you get

- Editing: tap, double tap and long press selection with handles, the loupe and the edit menu, undo and redo, auto indent, auto closing pairs, Tab and Shift+Tab, bracket matching, an active line, read only, a placeholder.
- Keyboards: soft keyboards with composition, the full [hardware key table](/guides/hardware-keyboard/), a [toolbar API](/reference/methods/#toolbar-input) that drives the same paths from JavaScript.
- View: a line number gutter, soft wrap or horizontal scroll, scroll to line, caret rect and visible lines for toolbars, content insets, an editor that [follows the keyboard](/guides/keyboard/).
- Search: literal or regex, case and whole word, next and previous, replace one or all, painted matches.
- Highlighting: fifteen [language packages](/reference/languages/), injections for fenced blocks, embedded script and style and tagged templates, three themes.

Next: [installation](/start/installation/), then the [quick start](/start/quick-start/).
