---
title: Architecture
description: The engine, its layers and threads, the tree-sitter binding and the Nitro layer.
sidebar_position: 1
---

The editor engine is written twice, in Kotlin and in Swift, with the same layers, the same names and the same test vectors, and it is bound to React Native through Nitro Views. The TypeScript wrapper, the tree-sitter runtime, the grammars and the vectors are shared.

## Why an own engine

A `TextInput` is one field stretched over a document: no gutter, no horizontal scroll, no control over undo and a layout of the whole text on every edit. A WebView pays a bridge and a second runtime per keystroke. The engine stores the document and draws through the platform's text layout API (`StaticLayout` on Android, Core Text on iOS), one visible line at a time. The soft keyboard talks to it through the platform's input protocol, so composition, suggestions and swipe typing work as in any text field.

## Layers

Under `me.sectiontn.codepad` in `android/src/main/java`:

| Layer | Holds | Depends on |
| --- | --- | --- |
| `core` | `Document`, `UndoManager`, `TextMovement`, `Indenter`, `AutoCloser`, `BracketMatcher`, `Searcher`, in pure Kotlin. | nothing |
| `input` | `ImeSession`, the keyboard protocol, and `KeyCommands`, the hardware key table. | core |
| `syntax` | `SyntaxEngine` and its thread, the tree-sitter JNI binding, `LanguageRegistry`, `Highlighter`, the per line span cache. | core |
| `layout` | `LineLayout` over `StaticLayout`, `HeightMap`, `LayoutCache`, `Viewport`, `CaretMover`, `GutterMetrics`. | core, syntax |
| `view` | `CodeEditorView`: drawing, gestures, scrolling, the input connection, handles, the edit menu, the keyboard inset tracker. | every layer before it |
| `com.margelo.nitro.codepad` | `HybridCodeEditorView` and `HybridCodepad`, the Nitro layer. | view |

The core runs `tests/vectors/*.json` on the JVM and under `swift test`. The keyboard protocol replays recordings: `tests/ime/*.json` from real Gboard sessions through `ImeSession`, and `tests/ime-ios/*.json` from the iOS keyboard through `MarkedTextSession`. A keyboard bug gets a recording before a fix.

### `core`

The document is an array of lines, each a growable UTF-16 buffer. `\r\n` and a `\r` on its own become `\n` on load. `replace(start, end, text)` is the only mutation. Undo groups hold the inverse changes plus the selection before and after. Single character typing merges into the previous group when it is adjacent, within a second and not a newline. API edits never merge with typing.

### `syntax`

One serial thread per editor holds the parser and the live tree. It applies each edit, reparses incrementally, reconciles the injected trees against the ranges tree-sitter reports as changed, and publishes an immutable snapshot to the main thread. The first parse of a large file runs with a time budget and resumes, and an edit during a parse is replayed onto its tree once it finishes.

The main thread queries the published snapshot for the visible lines only and caches the spans per line. A snapshot lists the regions whose structure changed, so the painter re-queries only the visible lines inside those regions. Overlapping captures apply in pattern order and the later pattern takes precedence, which is the rule nvim queries are written for.

### `layout`

`LineLayout` turns a line into a `StaticLayout` at the wrap width. The row height is uniform, `round(fontSize * lineHeight)`, so a fallback font for emoji or CJK never changes it. `HeightMap` stores a row count per line, with unmeasured lines counting as one. `LayoutCache` is an LRU around the viewport. Only a wrap width change drops it, and the scroll is then re-anchored to the top visible line.

### `view`

`CodeEditorView` is an `android.view.View` with an input connection, so the input method treats it as a text editor. It draws in this order: background, active line, search matches, bracket pair, selection, text, composing underline, gutter, caret, handles, placeholder. The view blocks its parent from intercepting touches only when it can scroll in the drag direction, which lets a parent `ScrollView` take over. Its input connection is a `BaseInputConnection` subclass over the document. The keyboard inset tracker registers a window insets animation callback when `avoidKeyboard` is on.

## The same engine in Swift

`ios/Codepad/` mirrors the Kotlin layers file for file:

| Layer | Holds | Differs from Android |
| --- | --- | --- |
| `core` | The same files, lines as `[UInt16]`, the document lock a `pthread_rwlock_t`. | Foundation only. Regular expressions through `NSRegularExpression`. |
| `input` | `KeyCommands` with the Mac modifiers, `GestureMachine`, `MarkedTextSession` (the `UITextInput` composition logic). | A long press places the caret under the loupe, a triple tap selects the line. |
| `syntax` | `TreeSitter.swift` over the C API, `SyntaxEngine` on a serial queue, `LanguageRegistry`, `Highlighter`, `SearchController`. | No JNI: the parser reads a `[UInt16]` mirror through a C callback. |
| `layout` | `LineLayout` over Core Text, `ThemeColors` as `CGColor`s, the rest one to one. | Tests on macOS. |
| `view` | `CodeEditorView`, a `UIScrollView`. `TextInputView`, the `UITextInput` conformer. The recycled `LineLayer`s, the highlight, cursor and handle views, the gesture recognizer, the edit menu, the keyboard inset tracker and the undo manager bridge. | UIKit, on the main actor, tested by XCTest on the simulator. |
| `nitro` | `HybridCodeEditorView` and `HybridCodepad`. | Nonisolated for the JS thread's readers. View work hops to the main actor. |

The pure layers compile as a Swift package at the repository root, with the tree-sitter runtime and the sixteen grammars as C targets, so `swift test` runs the vectors, the syntax and layout suites and the keyboard replays on macOS in seconds. The pod compiles the same files plus `view` and `nitro`. Both use the Swift 6 language mode.

The view is a `UIScrollView` whose content view conforms to `UITextInput` over UTF-16 offsets, so the system keyboard, dictation, autocorrect and hardware keys talk to the document directly. The visible lines are recycled `CALayer`s drawn through Core Text, keyed by the line's and the snapshot's revision. The selection UI is a `UITextSelectionDisplayInteraction` with the editor's own highlight, cursor and handle views, which is what lets the theme's `selection` and `cursor` apply exactly. The loupe is a `UITextLoupeSession`, the edit menu a `UIEditMenuInteraction`, and `undoManager` a Foundation `UndoManager` subclass over the core's groups. The scroll view's `contentInset` is never used, so `contentInsets`, the keyboard inset, `scrollToLine` and `onContentSizeChange` keep the Android semantics. Keyboard avoidance reads a tracking view pinned to the window's `keyboardLayoutGuide` through its presentation layer on every frame.

## Threads

| Thread | Does |
| --- | --- |
| Main | Mutates the document, selection and layout, holds the keyboard state, draws |
| JS | Sync readers under the read lock, receives events |
| Syntax, one per editor | Parses, runs injections and search, publishes snapshots |

The document lock is a `ReentrantReadWriteLock` on Android and a `pthread_rwlock_t` on iOS, and writers hold it for one `replace`. Writers from JavaScript post to the main thread and resolve after the change is applied, so a detached view still resolves them.

## The tree-sitter binding

The runtime is tree-sitter 0.26, vendored into the core library with hidden symbols. A generated `parser.c` is self contained, so language packages never link against the runtime. The binding works in UTF-16: the input is `UTF16LE` and byte offsets are halved at the boundary, so Kotlin and Swift see the offsets JavaScript uses. The parser's read callback reads a native UTF-16 mirror of the document, so a parse never calls back into the JVM. Predicates (`eq?`, `match?`, `any-of?`, `contains?`, `has-parent?`, `has-ancestor?` with their `not-` and `any-` forms) are evaluated in Kotlin and Swift, and `lua-match?` patterns become regular expressions at generation time.

### Injections and kept trees

The host tree's injection query yields ranges with a language. The name is converted to lowercase and aliased, `#offset!` trims columns, `injection.combined` ranges form one tree, children are always included, and injected trees do not run their own injection query.

Injected trees survive across snapshots. The engine keeps each one with the hull of its match and its extent, plus a copy of the host tree from the last completed pass. An edit goes to the reference tree and, by arithmetic, to the hulls and extents. A kept tree takes an edit only when the edit reaches it, and an edit before it accumulates as a shift the painter reads through. After a host reparse, `ts_tree_get_changed_ranges` gives the regions whose structure differs, the edits' own spans are added, and the injections query runs over those regions only. A kept tree the regions meet reparses against its old tree, and every other tree is carried over with no parser call. The first pass after `setText` or a language switch covers the whole document.

## The Nitro layer

`HybridCodeEditorView` owns one `CodeEditorView`, diffs incoming props into setters, wires the callbacks and forwards the methods. Sync readers take the document read lock on the JS thread. `getCursorRect()` and `getVisibleLines()` read a layout snapshot the main thread publishes after each layout pass. The wrapper fills in the defaults, wraps every callback once and normalizes `theme.tokens` into `{ color, bold, italic }` structs.

`HybridCodepad.availableLanguages()` lists the marker files under `assets/codepad-languages/` on Android and scans the class list for `CPLang` classes on iOS. The registry loads a language by name, checks its ABI against the runtime, compiles its queries once and caches the result for the process.

## Conventions

- UTF-16 offsets, half open ranges and 0 based lines and columns, in Kotlin, Swift, the parser and JavaScript alike.
- An unknown or failed language is one warning and plain text. Ranges clamp and swap. Methods called before `onReady` operate on the empty document. Only a regular expression that does not compile throws.
- Native never emits events from prop setters during the first batch, and object props are compared by identity before they cross.
