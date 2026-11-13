# Changelog

## 0.1.10 (2026-11-13)

### Editor

- The document, the selection, undo, auto-closing, indentation, cursor movement, bracket matching, decorations and search now run in the same C++ core as the highlighting, shared by Android and iOS. Each platform keeps its own view, text layout and keyboard handling.
- Search regular expressions now run on PCRE2 on both platforms, instead of Java regular expressions on Android and `NSRegularExpression` on iOS. Most patterns match as before. When a pattern does not compile, `setSearch()` still rejects, and the message now comes from PCRE2 and ends with the position of the error in the pattern. A pattern that backtracks too much stops at PCRE2's match limit and keeps the matches found before that point.
- Cursor movement and Backspace now find character boundaries with the Unicode 16.0 rules on every Android and iOS version. Before, they followed the Unicode version of the device, so an older device could split an emoji built from several code points.
- On Android, word movement and auto-closing now treat U+0085 (next line) as whitespace, and no longer treat U+001C to U+001F as whitespace. iOS already did both.
- `tabSize` is now kept between 1 and 64. Before, a negative value crashed the app when a line was indented.

## 0.1.9 (2026-11-11)

### Languages

- The new `react-native-codepad-lang-xml` package has two languages: `xml` for XML documents such as Android layouts and SVG files, and `dtd` for a standalone DTD file. A `<style>` or `<script>` element in XML highlights as CSS or JavaScript when those packages are installed.
- The new `react-native-codepad-lang-ini` package highlights INI files. Its grammar expects a newline after every line, the last one included. The [languages guide](https://reactnativecodepad.pages.dev/guides/languages/) lists what else it parses.
- Markdown code blocks and other injections named `svg`, `xsd`, `xsl`, `xslt` or `rng` now resolve to `xml`, and `dosini` or `confini` to `ini`.
- The `language` command now refuses `xml`, `dtd` and `ini` as ids. A custom package built under one of these ids with an earlier version still works on its own, but the app build fails when the shipped package is installed next to it. Rename its grammar before you build it again.
- Every language package now includes `THIRD_PARTY_NOTICES.md`, with the attribution for its nvim-treesitter queries. Earlier releases left that file out of the published package.

## 0.1.8 (2026-11-11)

### Editor

- Both platforms now highlight through one syntax engine written in C++, in place of the separate Kotlin and Swift engines. The shipped languages highlight exactly as before: the tests compare the colors of every sample file against a recording of the old engine. On the Android emulator, the example app used 10-14 MB less memory with the 10,000-line benchmark file open, most of it Java heap.
- On Android, pressing Enter in the middle of a line no longer crashes the app when a colored token follows the cursor. This happened in every 0.1 release. On both platforms, the text moved to the new line now keeps its colors until the new highlighting arrives, instead of showing plain for a frame.

### Languages

- The `match?` predicates in the queries of a custom language package now run on PCRE2 on both platforms, instead of Java regular expressions on Android and ICU on iOS. Most patterns match as before. On Android, `\w` and `\b` now match letters outside ASCII, and `.` no longer matches a vertical tab or a form feed. Both already worked this way on iOS.

## 0.1.7 (2026-11-10)

### Languages

- The new `react-native-codepad-lang-php` package has two languages. `php` highlights web pages: the PHP code between `<?php` and `?>`, and the HTML around it when `react-native-codepad-lang-html` is installed too. `php_only` highlights PHP code without the `<?php` tag. A heredoc such as `<<<HTML` highlights in the language it names.
- The new `react-native-codepad-lang-sql` package parses the usual MySQL statements, with keywords in any case. It doesn't parse `#` comments, `USE` statements or backslash escapes such as `'It\'s'`. The [languages guide](https://reactnativecodepad.pages.dev/guides/languages/) explains what happens to their colors. With the package installed, Markdown `sql` code blocks highlight too.
- The `language` command now refuses `php`, `php_only` and `sql` as ids. A custom package built under one of these ids with 0.1.5 or 0.1.6 still works on its own, but the app build fails when the shipped package is installed next to it. Rename its grammar before you build it again.

### Editor

- An injected language whose name comes after its code in the query now highlights. This fixes PHP heredocs, and it turns on Rust's macro injection, so the arguments of `println!`, `vec!` and other macros now highlight as Rust. Files with many macros take longer to parse: on a 5,000-line file with 3,500 macros, the first parse took about 240 ms instead of about 40 ms in the JVM test harness on a laptop.

### Docs

- The languages guide covers the two new packages, the PHP and SQL notes and their library sizes. The README, the site and the agent skill now count seventeen language packages.

The fifteen other language packages move to 0.1.7 with the core, unchanged.

## 0.1.6 (2026-11-10)

### Editor

- The new `decorations` prop marks code without changing it. An underline covers a range, solid or wavy, in the color you pick. A gap opens empty rows under a line, where your app places its own view, such as an error message. A line background tints a line. The editor keeps each decoration on its text through typing, keyboard suggestions, undo and redo, and the ref methods, on Android and iOS. The [decorations guide](https://reactnativecodepad.pages.dev/guides/decorations/) shows how each one follows an edit.
- `decorationsRevision` tells the editor which revision a result was computed for. When a checker answers after the user typed more, the editor moves its decorations through the edits made since then, up to the last 256.
- `onGapLayout` reports where every gap is after a gap appears, moves or goes away, and `getGapRect(line)` returns the rectangle of one gap. Both use the coordinates of `getCursorRect()`, so a note view lines up with its gap.

### Languages

- The `language` command now builds a package whose queries contain `"""#` or `\#`. Before, the first stopped the command after it had already removed the old package, and the second was read as an escape on iOS.
- The command now refuses an id that is a Java keyword, such as `int`, which used to break the Android build. It also checks every `.c`, `.h` and `.inc` file under `src/`, not only `scanner.c`, and stops with a message when one of them includes a file from outside `src/`. Before, the package was written without that file and failed to build.

### Docs

- The new decorations guide covers underlines, a note under a line, line backgrounds and how each one follows an edit. The reference covers the new props, the event, the method and the `Decoration` and `GapLayoutEvent` types, and the README tables list them too.

The fifteen language packages move to 0.1.6 with the core, unchanged.

## 0.1.5 (2026-11-10)

### Languages

- `npx react-native-codepad language <grammar-dir>` builds a language package from your own tree-sitter grammar. The package is written into your app (`modules/codepad-lang-<id>` by default), stays private, and highlights through `language="<id>"` like the packages CodePad ships. Expo autolinks it, and the [custom languages guide](https://reactnativecodepad.pages.dev/guides/custom-languages/) covers the grammar folder, the options and a cache to clear on Android.
- An installed language whose id is also an injection alias, such as `sql`, `bash` or `graphql`, now highlights inside Markdown code blocks and other injections. Before, those names never highlighted, even with a package installed.

### Docs

- The new custom languages guide explains how to prepare a grammar, build its package and link it in an Expo or a bare React Native app.
- The language package READMEs link the docs site instead of the old GitHub Pages address.

The fifteen language packages move to 0.1.5 with the core. Only their READMEs changed.

## 0.1.4 (2026-11-09)

### Editor

- With `scrollEnabled={false}`, lines wider than the editor now scroll sideways when you drag mostly horizontally. Every other drag still goes to the parent `ScrollView`. Before, a nested editor without `softWrap` had no way to show the end of a long line.

### Docs

- The nested scroll guide no longer requires `softWrap`. Add it when long lines should wrap within the page instead of scrolling sideways.
- The roadmap lists only the work left before 1.0.

The fifteen language packages move to 0.1.4 with the core, unchanged.

## 0.1.3 (2026-11-09)

### Editor

- The new `textPadding` prop sets the space between the text and the left and right edges of the editor, inside `contentInsets`. The default is 8, the same space the editor used before. You can change it at runtime on Android and iOS.
- `fontFamily` now takes the same names as React Native's `Text`. On iOS, an `expo-font` key now works (before, the editor drew Menlo instead). A family name such as `JetBrains Mono` now draws the regular style of that family, not bold and not italic. Before, iOS took the first style it found in the family, so four system families now look different: Avenir Next Condensed, Chalkboard SE, Hiragino Sans and Marker Felt.
- On Android, when `fontFamily` names a font that the app does not have, the editor now uses the default monospace font. Before, it used Roboto.
- On Android, text now draws at its exact size, so every column has the width the font asks for, the same as on iOS. For example, at 14 dp, 18 columns of JetBrains Mono are 151.2 dp wide. Before, normal code rounded each character to a whole pixel and italic comments used a slightly smaller size, so comments and code did not line up. Tabs now line up with spaces at every font size.
- Removing an optional prop at runtime (`language`, `fontFamily`, `placeholder`, `contentInsets` or `onChangeText`) no longer throws a render error.

### Docs

- The props reference and the README now explain which font names `fontFamily` accepts on each platform, and where `textPadding` adds its space: between the text and the left and right edges of the editor.

The fifteen language packages move to 0.1.3 with the core, unchanged.

## 0.1.2 (2026-10-27)

### Editor

- Typing while a large file is still in its first parse no longer restarts that parse. The engine finishes it on the text it started from, replays the edits made in the meantime onto its tree, and runs one incremental pass to catch up before it publishes the highlights. On the Android emulator, typing into the 100,000-line example file during its first parse used to hold the first highlight back for 32 seconds. It now arrives after 1.6 seconds. The fix covers the Android and iOS engines.

### Docs

- The README tables list every prop, event and method, worded like the reference pages (#2).
- Coding agents can install a skill that covers the setup, the API and the traps of treating the editor like a `TextInput`, with `npx skills add SectionTN/react-native-codepad`. The AI coding agents guide on the docs site explains how to use it.
- The docs site has a new design: the landing page, the docs layout, the navigation and the code blocks.

### Contributors

- Thanks to @fazi-gondal for the missing README API entries (#2, 3c2a064).

The fifteen language packages move to 0.1.2 with the core, unchanged.

## 0.1.1 (2026-10-20)

No changes to the editor. The core is republished so that npm shows the rewritten README (the banner, the demo and the API tables) and its `homepage` points at the docs site. The fifteen language packages move to 0.1.1 with it, unchanged.

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
