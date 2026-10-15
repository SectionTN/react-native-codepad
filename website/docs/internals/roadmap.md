---
title: Roadmap
description: Where the editors stand, the release plan and what is not in the first version.
sidebar_position: 3
---

## Now

Both editors are complete. Android is tested on the JVM and an emulator and measured against the [targets](/guides/performance/). iOS runs the same vectors under `swift test` and XCTest on the simulator; its device numbers wait for an iPhone.

## Release

`0.1.0` is the first npm release: the core and the fifteen language packages, in lockstep, with provenance. `1.0.0` needs the list below on both platforms.

## Not in the first version

- An autocomplete popup and provider hooks, and an LSP client on top.
- Code folding, a minimap, multiple cursors.
- Diagnostics: squiggles and a gutter marker API.
- VoiceOver and TalkBack: the view exposes nothing to screen readers yet.
- Font ligatures.
- Correct bidi editing: caret movement is logical.
- A web target.
- A built in keyboard toolbar. The [toolbar API](/reference/methods/#toolbar-input) and the example's key row are the building blocks.
- `indents.scm` and `locals.scm`: shipped in the packages, not loaded yet.
- `#set! priority` in queries.
- Second level injections.
- Pinch to zoom the font size.
- Edge auto scroll while dragging a selection handle past the viewport.
- On iOS: interactive keyboard dismissal, the keyboard appearance from the theme, iOS 15 and 16.
- Keyboards other than Gboard and the iOS system keyboard: recordings as bugs come in.
- A shared C++ core replacing the two engines.
