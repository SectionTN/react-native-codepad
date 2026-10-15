# Example app

A code editor built on `react-native-codepad`, with the chrome in native controls through `@expo/ui` (SwiftUI on iOS, Jetpack Compose on Android).

## Run

```sh
yarn example start
yarn example ios
yarn example android
```

The iOS build needs `bundle exec pod install` in `ios/` after a podspec or dependency change. The Android build installs the `debugOptimized` variant.

## What is in it

- The file picker in the top bar opens the fifteen sample files, three generated files (`10k-lines.js`, `100k-lines.js`, `2k-paragraphs.md`) and an empty one. The status bar reports the time to the first paint after every open.
- The find bar: literal or regex, case, whole word, replace one or all.
- The menu: undo, redo, select all, go to line, a search timing, the nested scroll demo, the settings sheet, the theme.
- The settings sheet: soft wrap, line numbers, active line, bracket matching, auto close, syntax highlighting, read only, suggestions, font size.
- The keyboard accessory bar: caret moves, Tab, Shift+Tab, Enter, Delete, the symbols, undo and redo, all through the ref methods.
- The nested scroll demo: an editor sized by `onContentSizeChange` inside a page that scrolls.

Everything under `src/native/` is split per platform; everything else is one tree for both.
