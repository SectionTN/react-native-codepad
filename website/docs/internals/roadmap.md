---
title: Roadmap
description: Where CodePad stands, what comes before 1.0 and what has no release yet.
sidebar_position: 3
---

CodePad 0.1 is on npm, with the core package and the seventeen language packages released together. This page lists what comes next and what has no release yet.

## Now

Both editors are complete. Android is tested on the JVM and on an emulator, and its numbers are in the [performance guide](/guides/performance/). iOS runs the same test vectors under `swift test` and XCTest on the simulator. Numbers from a physical iPhone are still missing.

## Before 1.0

The work planned before `1.0.0`, in order:

1. [Autocomplete](https://github.com/SectionTN/react-native-codepad/issues/3) with provider hooks, and an [LSP client](https://github.com/SectionTN/react-native-codepad/issues/6) on top of it.
2. [Code folding](https://github.com/SectionTN/react-native-codepad/issues/5) and a [minimap](https://github.com/SectionTN/react-native-codepad/issues/7).
3. [Multiple cursors](https://github.com/SectionTN/react-native-codepad/issues/8), [diagnostics](https://github.com/SectionTN/react-native-codepad/issues/4), [font ligatures](https://github.com/SectionTN/react-native-codepad/issues/9) and [correct bidi editing](https://github.com/SectionTN/react-native-codepad/issues/10). Caret movement is logical for now.
4. A [web target](https://github.com/SectionTN/react-native-codepad/issues/11).

`1.0.0` is the first stable release, with this list done on both platforms.

## Not scheduled

These have no release yet:

- A [built-in keyboard toolbar](https://github.com/SectionTN/react-native-codepad/issues/12). The [toolbar API](/reference/methods/#toolbar-input) and the example's key row are the building blocks.
- [`indents.scm` and `locals.scm`](https://github.com/SectionTN/react-native-codepad/issues/13). They ship in the packages but aren't loaded yet.
- [`#set! priority` in queries](https://github.com/SectionTN/react-native-codepad/issues/14).
- Second level injections.
- [Pinch to zoom the font size](https://github.com/SectionTN/react-native-codepad/issues/15).
- Edge auto scroll while dragging a selection handle past the viewport.
- On iOS: interactive keyboard dismissal, the keyboard appearance from the theme, and iOS 15 and 16.
- Keyboards other than Gboard and the iOS system keyboard, starting with [Samsung Keyboard](https://github.com/SectionTN/react-native-codepad/issues/16). Recordings are added as bugs come in.
- A [shared C++ core](https://github.com/SectionTN/react-native-codepad/issues/17) replacing the two engines.

Ideas and requests go to the [issues](https://github.com/SectionTN/react-native-codepad/issues).
