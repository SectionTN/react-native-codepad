---
title: Roadmap
description: What is deliberately not in the first version, the iOS editor and the release plan.
sidebar:
  order: 3
---

## Now

Android is complete: every feature on the [introduction](/react-native-codepad/start/introduction/) page is implemented, tested on the JVM and on an emulator, and measured against the [targets](/react-native-codepad/guides/performance/). Fifteen language packages are generated and committed, the themes cover every capture name, and this site documents the whole API.

## Next: iOS

The Swift engine, built to the same layers as the Kotlin one and run against the same vectors:

- `core` in Swift, passing `tests/vectors` in XCTest.
- A `UIScrollView` host with a `UITextInput` conformer as first responder, visible lines drawn through Core Text in recycled layers, `UITextInteraction` supplying the caret, handles, loupe and edit menu.
- Marked text for CJK and dictation, the smart punctuation traits off, `UIKeyCommand`s for the [hardware key table](/react-native-codepad/guides/hardware-keyboard/) with Cmd and Option, the undo stack exposed to the system.
- `avoidKeyboard` on iOS with the same overlap semantics.
- The language packages already ship their iOS side: a pod per package with the parser and a Swift provider.

## Release

`0.1.0` is the first npm release and ships when iOS reaches parity with Android on the same device walk. It publishes the core and the fifteen language packages in lockstep with provenance, from a tag, through a publish workflow that does not exist yet by design: nothing is pushed, tagged or published before then. `1.0.0` needs the full feature list below on both platforms.

## Not in the first version

Each of these is an issue to open and, for the ones worth it, a milestone:

- An autocomplete popup and provider hooks, and an LSP client on top of them.
- Code folding, a minimap, multiple cursors.
- Diagnostics: squiggles and a gutter marker API.
- VoiceOver and TalkBack: the editor is a custom view and exposes nothing to screen readers yet.
- Font ligatures.
- Correct bidi editing: the platform layout gives a best effort, caret movement is logical.
- A web target.
- A built in keyboard toolbar; the [toolbar API](/react-native-codepad/reference/methods/#toolbar-input) and the example's key row are the building blocks.
- `indents.scm` and `locals.scm`: both ship in the packages but are not loaded. Indentation is the heuristic indenter; locals based highlighting (a parameter colored at every use) is not done.
- `#set! priority` in queries, which nvim uses to rank overlapping patterns regardless of order.
- Second level injections and `injection.include-children` off.
- Pinch to zoom the font size.
- Samsung keyboard verification: Gboard is the tested keyboard; other keyboards get recordings as bugs come in.
- A shared C++ core replacing the two engines.
