# Changelog

# 0.1.0 (2026-10-19)

The first release: `react-native-codepad` and fifteen language packages, published together.

### Editor

- The editing core runs in Kotlin and Swift on the platform text APIs: selection with handles, the edit menu, soft keyboard composition, undo and redo with typing coalescing, auto indent, auto closing brackets and quotes, bracket matching, a read only mode and a placeholder.
- Hardware keyboards use the full key table, and the toolbar API (`moveCaret`, `typeText`, `deleteBackward`, `deleteForward`) drives the same paths from JavaScript.
- The view draws line numbers, soft wraps or scrolls horizontally, scrolls to a line, reveals the selection, reports the caret rect and the visible lines, takes content insets, and follows the keyboard animation frame by frame with `avoidKeyboard`.
- Search takes literal or regex queries with case and whole word options, finds next and previous, replaces one or all matches and paints them. The scan runs on a worker.

### Highlighting

- Highlighting is incremental tree-sitter parsing on a background thread, with injections for fenced blocks, embedded script and style, and tagged templates. Injected trees survive the edits that do not reach them.
- Fifteen language packages are generated from the nvim-treesitter queries: C, CSS, Go, HTML, Java, JavaScript, JSON, Kotlin, Markdown, Python, Rust, Swift, TSX, TypeScript and YAML. Install only the ones you use.
- Three themes are keyed by capture name with prefix lookup, so nvim-treesitter themes port by renaming.

### Bindings

- The Nitro view has a delta `onChange`, selection, scroll and focus events, `onContentSizeChange`, sync readers on the JS thread and async writers that resolve once applied. Offsets are UTF-16, the same as JavaScript strings.

### Platforms

- It runs on Android API 24 and up and on iOS 17 and up, with React Native 0.81 or newer on the New Architecture.
- The two engines run the same test vectors, and the keyboard recordings replay on the JVM. The iOS numbers come from the simulator. Measurements from a physical iPhone are still missing.

### Not in this release

Autocomplete, an LSP client, code folding, a minimap, multiple cursors, diagnostics, font ligatures, bidi editing and web. Each is tracked as an issue on GitHub.
