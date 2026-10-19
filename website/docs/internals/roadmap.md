---
title: Roadmap
description: Where the editors stand, the release plan and what is not in the first version.
sidebar_position: 3
---

## Now

Both editors are complete. Android is tested on the JVM and on an emulator and measured in the [performance guide](/guides/performance/). iOS runs the same vectors under `swift test` and XCTest on the simulator. Numbers from a physical iPhone are still missing.

## Release

`0.1.0` is the first npm release: the core and the fifteen language packages, published together. `1.0.0` needs the list below on both platforms.

## Not in the first version

- An autocomplete popup with provider hooks, and an LSP client on top of it.
- Code folding, a minimap and multiple cursors.
- Diagnostics: squiggles and a gutter marker API.
- Font ligatures.
- Correct bidi editing. Caret movement is logical for now.
- A web target.
- A built in keyboard toolbar. The [toolbar API](/reference/methods/#toolbar-input) and the example's key row are the building blocks.
- `indents.scm` and `locals.scm`. They ship in the packages but are not loaded yet.
- `#set! priority` in queries.
- Second level injections.
- Pinch to zoom the font size.
- Edge auto scroll while dragging a selection handle past the viewport.
- On iOS: interactive keyboard dismissal, the keyboard appearance from the theme, and iOS 15 and 16.
- Keyboards other than Gboard and the iOS system keyboard. Recordings are added as bugs come in.
- A shared C++ core replacing the two engines.
