---
title: Introduction
description: What react-native-codepad is, where it stands and what comes next.
sidebar:
  order: 1
---

react-native-codepad is a code editor component for React Native with its own text engine on each platform. The document, layout, selection, undo and keyboard input live in Kotlin on Android and in Swift on iOS, on top of the platform text APIs. Syntax highlighting comes from tree-sitter, parsing incrementally on a background thread, one language per npm package. The component is bound through Nitro Views, so props, events and ref methods cross to native without a bridge round trip, and sync readers such as `getText()` return on the JS thread.

There is no WebView and no `TextInput` underneath. Scrolling, selection handles, the edit menu and the caret are drawn and handled by the view itself, which is what keeps a 100k line file scrolling at the frame rate.

:::note[Status]
Pre-release. The Android editor is complete and measured on every feature below. The iOS editor is in progress: the package compiles and links on iOS with a stub view so a cross platform app builds, but nothing renders there yet. The packages are not on npm; the first release, `0.1.0`, ships together with iOS.
:::

## What you get

- Editing: tap, double tap and long press selection with handles and the edit menu, soft keyboards with composition, undo and redo with typing coalescing, auto indent, auto closing brackets and quotes, Tab and Shift+Tab indentation, bracket matching, an active line highlight, a read only mode and a placeholder.
- Hardware keyboards: the full [key table](/react-native-codepad/guides/hardware-keyboard/), and a [toolbar API](/react-native-codepad/reference/methods/#toolbar-input) that drives the same paths from JavaScript.
- View: a line number gutter, soft wrap or horizontal scrolling, scroll to line, reveal selection, caret rect and visible lines for toolbars, content insets, and an editor that [follows the keyboard](/react-native-codepad/guides/keyboard/) frame by frame.
- Search: literal or regex, case and whole word options, find next and previous with wrap around, replace one or all, painted matches.
- Highlighting: fifteen [language packages](/react-native-codepad/reference/languages/), injections for fenced blocks, embedded script and style and tagged templates, three themes and a token model that ports from nvim-treesitter.

## What comes next

Phase 8 is the iOS editor: the Swift core runs the same test vectors as the Kotlin one, the view is a `UIScrollView` with a `UITextInput` conformer drawn through Core Text, and `avoidKeyboard` learns the iOS keyboard. `0.1.0` ships when both platforms pass the same walk. The [roadmap](/react-native-codepad/internals/roadmap/) lists what is deliberately out of the first version.

Start with the [installation](/react-native-codepad/start/installation/) page, then the [quick start](/react-native-codepad/start/quick-start/).
