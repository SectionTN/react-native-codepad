---
title: Architecture
description: The engine, its layers and threads, the tree-sitter binding and the Nitro layer.
sidebar:
  order: 1
---

react-native-codepad is an editor engine written twice, in Kotlin and in Swift, with the same layers, the same names and the same test vectors, bound to React Native through Nitro Views. Shared across platforms: the TypeScript wrapper, the tree-sitter runtime and grammars, and the vectors. The Android engine is described first; the Swift section says where the iOS one differs.

## Why an own engine

A `TextInput` is a single field's behavior stretched over a document: no gutter, no horizontal scroll, no control over the undo stack, a layout of the whole text on every edit. A WebView editor pays a bridge and a second runtime for every keystroke. The engine instead owns the document and draws text through the platform's text layout API (`StaticLayout` on Android, Core Text on iOS) line by line, laying out only what is on screen. The soft keyboard talks to it through the platform's input connection protocol, so composition, suggestions and swipe typing work as in any text field.

## Layers

All under `me.sectiontn.codepad` in `android/src/main/java`:

| Layer | Holds | Depends on |
| --- | --- | --- |
| `core` | `Document`, `UndoManager`, `TextMovement`, `Indenter`, `AutoCloser`, `BracketMatcher`, `Searcher`. Pure Kotlin, no Android types. | nothing |
| `input` | `ImeSession`, the keyboard protocol as pure Kotlin, and `KeyCommands`, the hardware key table. | core |
| `syntax` | `SyntaxEngine` and its thread, the tree-sitter JNI binding, `LanguageRegistry`, `Highlighter` and the per line span cache. | core |
| `layout` | `LineLayout` over `StaticLayout`, `HeightMap`, `LayoutCache`, `Viewport`, `CaretMover`, `GutterMetrics`. | core, syntax |
| `view` | `CodeEditorView`: drawing, gestures, scrolling, the input connection, handles, the edit menu, the keyboard inset tracker. | everything above |
| `com.margelo.nitro.codepad` | `HybridCodeEditorView` and `HybridCodepad`, the Nitro layer. | view |

The core is tested on the JVM against `tests/vectors/*.json`, JSON cases per area (document, positions, undo, indent, auto close, brackets, search, movement) that the Swift core runs under `swift test` too. The keyboard protocol is tested the same way: `tests/ime/*.json` are recordings of real Gboard sessions that replay through `ImeSession` on the JVM, and `tests/ime-ios/*.json` recordings of the iOS keyboard's `UITextInput` calls that replay through `MarkedTextSession`, so a keyboard bug gets a recording before a fix.

### core

The document is an array of lines, each a growable UTF-16 buffer without its terminator; `\r\n` and lone `\r` become `\n` on load. `replace(start, end, text)` is the only mutation and returns the change with the removed and inserted text; line start offsets are prefix sums with a dirty marker, recomputed lazily. Undo groups hold inverse changes plus the selection before and after; single character typing merges into the previous group when adjacent, not a newline, within a second and with the selection untouched between them. API edits never merge with typing. The searcher runs literal or `java.util.regex` matching over a full text snapshot cached per revision, never overlapping, skipping empty matches.

### syntax

One serial thread per editor owns the parser and the live tree. It receives edits in document order, applies `ts_tree_edit`, reparses incrementally, runs the injection query, parses each injected range set with `ts_parser_set_included_ranges`, and publishes an immutable snapshot (a tree copy, the injected trees, the changed ranges, parse statistics) to the main thread. The first parse of a large file runs with a time budget and resumes; an edit during a parse cancels it.

The main thread queries only the published snapshot, restricted to the visible range, and caches spans per line keyed by the line's revision. A line edited after the snapshot paints plain until the next snapshot lands, one frame in practice. Spans are `(startColumn, endColumn, capture)` in UTF-16 columns, clipped per line; overlapping captures apply in pattern order and the later pattern wins, which is the rule nvim queries are written for.

### layout

`LineLayout` turns a line's text and spans into a `StaticLayout` at the wrap width, with tab stops at `tabSize` columns. Row height is uniform, `round(fontSize * lineHeight)`, forced through line spacing so a fallback font for emoji or CJK never changes it. `HeightMap` stores a row count per line, unmeasured lines counting as one, with prefix sums for y positions. `LayoutCache` is an LRU of laid out lines around the viewport; only a wrap width change drops it, re-anchoring the scroll to the top visible line so the view never jumps. A height change or an inset change keeps the layouts and clamps the scroll.

### view

`CodeEditorView` is an `android.view.View` that reports itself as a text editor. Drawing order: background, active line, search matches, bracket pair, selection, text, composing underline, gutter, caret, handles, placeholder. Scrolling is free in both axes with the platform scroller and edge effects, and the view only asks its parent not to intercept when it can scroll in the drag direction, which is what lets a parent `ScrollView` take over. Its input connection is an own `BaseInputConnection` subclass over the document, with the composing range tracked by the editor, batch edits counted, and cursor anchor info sent when the keyboard asks. Hardware keys map through the key table. The keyboard inset tracker registers a window insets animation callback on the view when `avoidKeyboard` is on and feeds the overlap into the bottom inset per frame.

## The same engine in Swift

`ios/Codepad/` mirrors the Kotlin layers file for file, under the same names:

| Layer | Holds | Differs from Android |
| --- | --- | --- |
| `core` | The same files, with lines as `[UInt16]` arrays and the document lock a `pthread_rwlock_t`. | Foundation only. Regex through `NSRegularExpression`, graphemes through `String` indices. |
| `input` | `KeyCommands` with the Mac modifiers, `GestureMachine`, and `MarkedTextSession`, the composition logic of `UITextInput` and the counterpart of `ImeSession`. | A long press places the caret under the loupe instead of selecting the word, and a triple tap selects the line. |
| `syntax` | `TreeSitter.swift` over the C API, `SyntaxEngine` on a serial dispatch queue, `LanguageRegistry`, `Highlighter`, `SearchController`. | No JNI: the parser reads a `[UInt16]` mirror through a C read callback. Languages are `CPLang<Pascal>` classes resolved by name. |
| `layout` | `LineLayout` over Core Text (`CTTypesetter` rows, one `CTLine` each), `ThemeColors` as `CGColor`s, the rest one to one. | Foundation, Core Text and Core Graphics only, so it tests on macOS. |
| `view` | `CodeEditorView`, a `UIScrollView`; `TextInputView`, its content and the `UITextInput` conformer; `GutterView`; the recycled `LineLayer`s; the highlight, cursor and handle views; the gesture recognizer; the edit menu; the keyboard inset tracker; the undo manager bridge. | UIKit, on the main actor, tested by XCTest on the simulator. |
| `nitro` | `HybridCodeEditorView` and `HybridCodepad`. | Nonisolated for the JS thread's sync readers; everything that touches the view hops to the main actor. |

The pure layers compile as a Swift package at the repository root: `Package.swift` declares the tree-sitter runtime and the sixteen grammars as C targets, the four layers as the `Codepad` module and the tests under `tests/swift`, so `swift test` runs the vectors, the syntax and layout suites and the keyboard replays on macOS in seconds, in CI too. The pod compiles the same files plus `view` and `nitro` under the same module name. Both builds use Swift 6 language mode: the core is a `Sendable` class behind its read-write lock, the engine publishes immutable snapshots, everything under `view` is on the main actor, and the hybrid object creates its view on the main actor from the JS thread's `init`.

The view is a `UIScrollView` whose content view conforms to `UITextInput` over integer UTF-16 offsets, so the system keyboard, dictation, autocorrect and hardware keys all talk to the document directly; composition is a pure `MarkedTextSession`. Visible lines are recycled `CALayer`s drawn through Core Text and keyed by the line's and the snapshot's revision, so scrolling composites and only lines entering the viewport render. The selection UI is `UITextSelectionDisplayInteraction` with the editor's own highlight, cursor and handle views, which is what lets the theme's `selection` and `cursor` apply exactly; the gestures are a port of the Android machine, the loupe a `UITextLoupeSession`, the edit menu a `UIEditMenuInteraction`, and `undoManager` a Foundation `UndoManager` subclass over the core's groups. Insets stay the editor's: the scroll view's `contentInset` is never used and the content size is the viewport's plus its insets, so `contentInsets`, the keyboard inset, `scrollToLine` and `onContentSizeChange` keep the Android semantics. Keyboard avoidance reads a tracking view pinned to the window's `keyboardLayoutGuide` through its presentation layer on every frame of the keyboard animation.

## Threads

| Thread | Does |
| --- | --- |
| Main | Mutates the document, selection and layout, owns the keyboard state, draws |
| JS | Sync readers under the read lock, receives events |
| Syntax, one per editor | Parses, runs injections and search, publishes snapshots; a thread on Android, a serial dispatch queue on iOS |

The document lock is a `ReentrantReadWriteLock` on Android and a `pthread_rwlock_t` on iOS; writers hold it only for one `replace`. Writers from JavaScript post to the main thread (a `Handler`, `DispatchQueue.main`) and resolve their promise after the change is applied and the view is invalidated, so a detached view still settles them.

## The tree-sitter binding

The runtime is tree-sitter 0.26.13, vendored whole into the core library with its symbols hidden; language packages never link against it because a generated `parser.c` is self contained. The JNI binding is about 25 functions over parser, tree, query, cursor and node, and it works in UTF-16: input is `UTF16LE` and byte offsets are halved at the boundary, so Kotlin only ever sees UTF-16 units, the same offsets JavaScript uses.

The binding keeps a native UTF-16 mirror of the document. The syntax thread applies each edit to the mirror before `ts_tree_edit`, and the parser's read callback reads the mirror directly, so a parse never calls back into the JVM. On iOS Swift calls the C API directly: `TreeSitter.swift` wraps parser, tree, query, cursor and node under the same rule, the parser reading a `[UInt16]` mirror through a `TSInput` in UTF-16 mode with a C read callback, every byte tree-sitter reports halved at the boundary. The pod compiles the runtime with hidden symbols like the Android library; the Swift package behind `swift test` compiles it as a C target. Predicates are evaluated in Kotlin and Swift from the steps the C runtime hands out: `eq?`, `match?`, `any-of?`, `contains?`, `has-parent?` and `has-ancestor?` with their `not-` and `any-` forms, and `#set!` and `#offset!` as directives. `lua-match?` patterns are translated to regular expressions by the generator at build time.

### Injections and kept trees

The host tree's injection query yields content ranges with a language, from a capture or a `#set!`. The name is lowercased and aliased, `#offset!` trims columns when its row deltas are zero, and ranges with `injection.combined` form one tree. Children are always included. One level only: injected trees do not run their own injection query.

Injected trees survive across snapshots. Each one is kept by the engine with its own copy, receives every `InputEdit` the host receives (tree-sitter shifts its included ranges with the nodes), and after the host reparse the new ranges are matched against the kept trees by language and included ranges. A match reparses with the old tree, so untouched ranges reuse every node; no match parses fresh; kept trees without a match close. Each snapshot carries the count of fresh and reused injections and the edit to snapshot latency, which the view logs under the debug switch and the typing bench reads.

## The Nitro layer

`HybridCodeEditorView` owns one `CodeEditorView`, diffs incoming props into setters, wires callback props to listeners and forwards methods. Sync readers take the document read lock on the JS thread; `getCursorRect()` and `getVisibleLines()` read a layout snapshot the main thread publishes after each layout pass. The TypeScript wrapper fills defaults, wraps every callback once so inline handlers are free, and normalizes `theme.tokens` so every token crosses as a `{ color, bold, italic }` struct.

`HybridCodepad.availableLanguages()` lists marker files under `assets/codepad-languages/` on Android, one per grammar a package ships, and on iOS scans the Objective-C class list for `CPLang` classes conforming to `CPLanguageProvider`. The registry then loads a language by name, `me.sectiontn.codepad.lang.<id>.<Pascal>Language` through reflection on Android and the `CPLang<Pascal>` class on iOS, checks its ABI against the runtime's range, compiles its queries once and caches the result for the process.

## Conventions

- UTF-16 code units for offsets everywhere, half open ranges, 0 based lines and columns. The same text has the same offsets in Kotlin, in Swift, in the parser and in JavaScript.
- An unknown or failed language is one warning and plain text. Method ranges clamp to the document and swap when reversed. Methods before `onReady` operate on the empty document. Nothing throws except a regex that does not compile, which rejects `setSearch`.
- Native code never emits events from prop setters during the first batch, and object props are compared by identity before they cross.
