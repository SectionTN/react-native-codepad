---
title: Roadmap
description: Where both editors stand, the hardening pass, the release plan and what is deliberately not in the first version.
sidebar_position: 3
---

## Now

Both editors are complete. On Android every feature on the [introduction](/start/introduction/) page is implemented, tested on the JVM and on an emulator, and measured against the [targets](/guides/performance/). On iOS the Swift engine runs the same vectors under `swift test`, the view and input suites run as XCTest on the simulator, and the example walks the same list as Android on an iPhone simulator. Fifteen language packages are generated and committed, the themes cover every capture name, and this site documents the whole API.

Pending a device: the iOS editor is verified on the simulator, so touch feel, dictation and Scribble have not been tried on hardware, and its performance numbers are simulator numbers kept for regressions rather than published.

## Next: hardening and the release

A hardening pass over both platforms before anything ships: bug hunting on the walk the two editors share, a fresh review of the engines, the findings fixed under test. Then the release pipeline: a version script, release-it, a publish workflow with provenance, a changelog, and the "not on npm yet" notes removed.

## Release

`0.1.0` is the first npm release and ships at the end of that pass. It publishes the core and the fifteen language packages in lockstep with provenance, from a tag, through a publish workflow that does not exist yet by design: nothing is pushed, tagged or published before then. `1.0.0` needs the full feature list below on both platforms.

## Not in the first version

Each of these is an issue to open and, for the ones worth it, a milestone:

- An autocomplete popup and provider hooks, and an LSP client on top of them.
- Code folding, a minimap, multiple cursors.
- Diagnostics: squiggles and a gutter marker API.
- VoiceOver and TalkBack: the editor is a custom view and exposes nothing to screen readers yet.
- Font ligatures.
- Correct bidi editing: the platform layout gives a best effort, caret movement is logical.
- A web target.
- A built in keyboard toolbar; the [toolbar API](/reference/methods/#toolbar-input) and the example's key row are the building blocks.
- `indents.scm` and `locals.scm`: both ship in the packages but are not loaded. Indentation is the heuristic indenter; locals based highlighting (a parameter colored at every use) is not done.
- `#set! priority` in queries, which nvim uses to rank overlapping patterns regardless of order.
- Second level injections and `injection.include-children` off.
- Pinch to zoom the font size.
- Edge auto scroll while dragging a selection handle past the viewport, on both platforms.
- On iOS: interactive keyboard dismissal (the drag that follows the finger), the keyboard appearance from the theme, and iOS 15 and 16 (the selection UI is built on iOS 17 API).
- Other keyboards: Gboard is the tested keyboard on Android and the system keyboard on iOS; others get recordings as bugs come in.
- A shared C++ core replacing the two engines.
