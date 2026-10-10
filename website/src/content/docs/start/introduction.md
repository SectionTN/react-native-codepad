---
title: Introduction
description: What react-native-codepad is, where it stands and what comes next.
sidebar:
  order: 1
---

react-native-codepad is a code editor component for React Native with its own text engine on each platform. The document, layout, selection, undo and keyboard input live in Kotlin on Android and in Swift on iOS, on top of the platform text APIs. Syntax highlighting comes from tree-sitter, parsing incrementally on a background thread, one language per npm package. The component is bound through Nitro Views, so props, events and ref methods cross to native without a bridge round trip, and sync readers such as `getText()` return on the JS thread.

There is no WebView and no `TextInput` underneath. Scrolling, selection handles, the edit menu and the caret are drawn and handled by the view itself, which is what keeps a 100k line file scrolling at the frame rate.

:::note[Status]
Pre-release. Both editors are complete and tested on every feature below: Android on the JVM and on an emulator, measured against the performance targets; iOS under `swift test` and XCTest on the simulator, with device numbers pending. The packages are not on npm; `0.1.0`, the first release, follows a hardening pass over both platforms.
:::

## What you get

- Editing: tap, double tap and long press selection with handles, the magnifier or loupe and the edit menu (a triple tap selects the line on iOS), soft keyboards with composition, undo and redo with typing coalescing, auto indent, auto closing brackets and quotes, Tab and Shift+Tab indentation, bracket matching, an active line highlight, a read only mode and a placeholder.
- Hardware keyboards: the full [key table](/react-native-codepad/guides/hardware-keyboard/), and a [toolbar API](/react-native-codepad/reference/methods/#toolbar-input) that drives the same paths from JavaScript.
- View: a line number gutter, soft wrap or horizontal scrolling, scroll to line, reveal selection, caret rect and visible lines for toolbars, content insets, and an editor that [follows the keyboard](/react-native-codepad/guides/keyboard/) frame by frame.
- Search: literal or regex, case and whole word options, find next and previous with wrap around, replace one or all, painted matches.
- Highlighting: fifteen [language packages](/react-native-codepad/reference/languages/), injections for fenced blocks, embedded script and style and tagged templates, three themes and a token model that ports from nvim-treesitter.

## What comes next

A hardening pass over both platforms: bug hunting on the walk the two editors share, a fresh review of the engines, the findings fixed under test. Then the release pipeline and `0.1.0`. The [roadmap](/react-native-codepad/internals/roadmap/) has the details and lists what is deliberately out of the first version.

Start with the [installation](/react-native-codepad/start/installation/) page, then the [quick start](/react-native-codepad/start/quick-start/).
