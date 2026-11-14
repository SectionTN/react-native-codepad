---
title: Roadmap
description: Where CodePad stands, what comes before 1.0 and what has no release yet.
sidebar_position: 3
---

CodePad 0.1 is on npm, with the core package and nineteen language packages released together. This page lists what comes next and what has no release yet.

## Now

Both editors are complete, and they run on one C++ core shared by Android and iOS. Android is tested on the JVM and on an emulator, and its numbers are in the [performance guide](/guides/performance/). iOS runs the same shared tests under `swift test` and XCTest on the simulator. Numbers from a physical iPhone are still missing.

## Before 1.0

The work planned before `1.0.0`, in order:

1. [Autocomplete](https://github.com/SectionTN/react-native-codepad/issues/3) with provider hooks, and an [LSP client](https://github.com/SectionTN/react-native-codepad/issues/6) on top of it.
2. [Code folding](https://github.com/SectionTN/react-native-codepad/issues/5) and a [minimap](https://github.com/SectionTN/react-native-codepad/issues/7).
3. [Multiple cursors](https://github.com/SectionTN/react-native-codepad/issues/8), [diagnostics](https://github.com/SectionTN/react-native-codepad/issues/4), [font ligatures](https://github.com/SectionTN/react-native-codepad/issues/9) and [correct bidi editing](https://github.com/SectionTN/react-native-codepad/issues/10). [Decorations](/guides/decorations/) already draw the underlines that diagnostics need. Until then, the arrow keys move through right-to-left text in the order it is stored, not in the order it shows on screen.
4. A [web target](https://github.com/SectionTN/react-native-codepad/issues/11).

`1.0.0` is the first stable release, with this list done on both platforms.

## Not scheduled

These have no release yet:

- A [built-in keyboard toolbar](https://github.com/SectionTN/react-native-codepad/issues/12). The [toolbar API](/reference/methods/#toolbar-input) and the example app's key row are the building blocks.
- [Indentation and colors from each grammar's `indents.scm` and `locals.scm`](https://github.com/SectionTN/react-native-codepad/issues/13). The packages ship these files, but the editor doesn't read them.
- [`#set! priority` in highlight queries](https://github.com/SectionTN/react-native-codepad/issues/14). Without it, a few overlapping patterns color differently from Neovim.
- Code embedded two levels deep, such as an HTML template inside a JavaScript block in Markdown.
- [Pinch to zoom the font size](https://github.com/SectionTN/react-native-codepad/issues/15).
- Scrolling the editor while you drag a selection handle past its edge.
- On iOS: dismissing the keyboard by dragging it down, a dark keyboard for dark themes, and support for iOS 15 and 16.
- Testing with keyboards other than Gboard and the iOS system keyboard, starting with [Samsung Keyboard](https://github.com/SectionTN/react-native-codepad/issues/16).

Ideas and requests go to the [issues](https://github.com/SectionTN/react-native-codepad/issues).
