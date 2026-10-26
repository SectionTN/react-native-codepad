<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/SectionTN/react-native-codepad/main/.github/assets/codepad-banner-dark.png" />
  <img alt="React Native CodePad, a native code editor for React Native" src="https://raw.githubusercontent.com/SectionTN/react-native-codepad/main/.github/assets/codepad-banner-light.png" />
</picture>

[![npm](https://img.shields.io/npm/v/react-native-codepad?style=flat-square)](https://www.npmjs.com/package/react-native-codepad)
[![license](https://img.shields.io/npm/l/react-native-codepad?style=flat-square&label=license)](https://github.com/SectionTN/react-native-codepad/blob/main/LICENSE)

A native code editor for React Native. It runs its own engine in Kotlin on Android and Swift on iOS, with tree-sitter highlighting and no WebView.

<picture>
  <source type="image/webp" srcset="https://raw.githubusercontent.com/SectionTN/react-native-codepad/main/.github/assets/codepad-showcase.webp" />
  <img alt="The example app on iOS and Android side by side: typing with highlighting, soft wrap and the font size slider, find and replace, and the theme switch" src="https://raw.githubusercontent.com/SectionTN/react-native-codepad/main/.github/assets/codepad-showcase.gif" />
</picture>

## Features

- Tree-sitter highlighting with one npm package per language, fifteen to pick from
- Selection handles, the edit menu, undo and redo, auto indent and auto closing brackets
- Find and replace with literal or regular expression queries and every match painted
- Hardware keyboards, a toolbar API and three themes keyed by capture name
- An editor that follows the keyboard animation frame by frame
- The same engine and the same test vectors on both platforms

## Installation

```sh
npm install react-native-codepad react-native-nitro-modules react-native-codepad-lang-javascript
cd ios && pod install
```

Requirements:

- React Native 0.81+ with the New Architecture
- iOS 17+, with `platform :ios, '17.0'` in the Podfile
- Android 7.0+ (API 24)
- Expo: a development build or `npx expo prebuild` (Expo Go isn't supported)
- One `react-native-codepad-lang-*` package for each language you highlight

## Usage

```tsx
import { useRef } from 'react';
import { CodeEditor, type CodeEditorRef, githubDark } from 'react-native-codepad';

const INITIAL = 'export const answer = 42;\n';

export function Screen() {
  const editor = useRef<CodeEditorRef>(null);
  return (
    <CodeEditor
      ref={editor}
      style={{ flex: 1 }}
      initialValue={INITIAL}
      language="javascript"
      theme={githubDark}
      onReady={() => console.log('lines', editor.current?.getLineCount())}
      onChange={(e) => console.log(e.origin, e.start, e.end, e.text)}
    />
  );
}
```

## API

`CodeEditor` takes the usual `View` props, plus the ones below. The [reference](https://reactnativecodepad.pages.dev/reference/props/) lists every prop, method, event and type.

### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `initialValue` | `string` | `''` | Sets the initial text. It is read once, so use `setText()` to replace the document later. |
| `language` | `string` | undefined | The id of an installed language package. Without it the editor shows plain text. |
| `theme` | `Theme` | `githubLight` | The colors. `githubDark` and `oneDark` ship too, and a theme is a plain object you can write yourself. |
| `fontFamily` | `string` | `monospace` on Android, `Menlo` on iOS | The font, by name. |
| `fontSize` | `number` | `14` | In dp on Android and points on iOS. |
| `lineHeight` | `number` | `1.4` | A multiplier of the font size. |
| `softWrap` | `boolean` | `false` | Wraps long lines. Off means horizontal scrolling. |
| `lineNumbers` | `boolean` | `true` | Shows the line number gutter. |
| `highlightActiveLine` | `boolean` | `true` | Paints the line the caret is on. |
| `matchBrackets` | `boolean` | `true` | Paints the bracket pair at the caret. |
| `placeholder` | `string` | undefined | Text drawn while the document is empty. |
| `readOnly` | `boolean` | `false` | Hides the keyboard and refuses edits. Selection and copy keep working. |
| `autoCloseBrackets` | `boolean` | `true` | Closes pairs as you type and skips over a closer you type yourself. |
| `autoIndent` | `boolean` | `true` | A newline keeps the line's indentation and adds a level inside an open bracket. |
| `insertSpaces` | `boolean` | `true` | Indents with spaces. Off indents with tabs. |
| `tabSize` | `number` | `4` | The width of one indentation level. |
| `suggestions` | `Suggestions` | `'off'` | `'on'` allows autocorrect. `'forceOff'` also stops composition on most Android keyboards. |
| `autoFocus` | `boolean` | `false` | Focuses the editor and shows the keyboard once the view is attached. |
| `scrollEnabled` | `boolean` | `true` | Off lets a parent `ScrollView` scroll through the editor. |
| `contentInsets` | `ContentInsets` | all 0 | The padding inside the scrollable area. Style padding on the view is ignored. |
| `avoidKeyboard` | `boolean` | `false` | Adds the keyboard overlap to the bottom inset on every frame of the keyboard animation. |
| `onReady` | `() => void` | | Called once after the first draw. Ref methods are valid from here. |
| `onChange` | `(event) => void` | | Called after every edit with the replaced range, the new text and its origin. |
| `onChangeText` | `(text) => void` | | Called with the full text after every change. Prefer `onChange` on large documents. |
| `onSelectionChange` | `(selection) => void` | | Called when the caret or the selection moves. |
| `onFocus`, `onBlur` | `() => void` | | Called when the editor gains or loses focus. |
| `onScroll` | `(event) => void` | | Called with the scroll offset and the content size, at most once per frame. |
| `onContentSizeChange` | `(event) => void` | | Called when the content size changes, insets included. |

### Methods

| Method | Description |
| --- | --- |
| `getText()`, `getTextInRange(range)`, `getLine(index)`, `getLength()`, `getLineCount()` | Read the document synchronously on the JS thread. |
| `getSelection()`, `getRevision()`, `getCursorRect()`, `getVisibleLines()` | Read the selection, the revision, the caret rectangle and the lines on screen. |
| `offsetToPosition(offset)`, `positionToOffset(position)` | Convert between UTF-16 offsets and 0-based lines and columns. |
| `canUndo()`, `canRedo()`, `isFocused()` | Report whether there is an edit to undo or redo and whether the editor has focus. |
| `setText(text)`, `replaceRange(range, text)`, `insertText(text)` | Change the document. Each resolves once the edit is applied. |
| `setSelection(selection)`, `selectAll()`, `scrollToLine(line)`, `revealSelection()` | Move the selection and the viewport. |
| `undo()`, `redo()`, `indent()`, `outdent()`, `cut()`, `copy()`, `paste()` | The edit menu, from JavaScript. |
| `moveCaret(direction)`, `typeText(text)`, `deleteBackward()`, `deleteForward()` | The toolbar API. Each goes through the same path as the keyboard. |
| `setSearch(query)`, `findNext()`, `findPrevious()`, `replaceCurrent(text)`, `replaceAll(text)`, `clearSearch()` | Search, with the match count and the painted matches. |
| `focus()`, `blur()` | Show or hide the keyboard. |

## Coding agents

The CodePad skill gives coding agents such as Claude Code, Codex and Cursor the API and its pitfalls:

```sh
npx skills add SectionTN/react-native-codepad
```

The docs are also available as plain text in [`llms-full.txt`](https://reactnativecodepad.pages.dev/llms-full.txt). The [AI coding agents guide](https://reactnativecodepad.pages.dev/guides/ai-agents/) has the details.

## Roadmap

- [x] 0.1: Android and iOS, fifteen languages, search, themes, the keyboard follower
- [ ] Autocomplete and an LSP client
- [ ] Code folding and a minimap
- [ ] Multiple cursors, diagnostics, font ligatures and bidi editing
- [ ] Web
- [ ] 1.0: First stable release

## Contributing

See the [contributing guide](https://github.com/SectionTN/react-native-codepad/blob/main/CONTRIBUTING.md). Questions and ideas go to [Issues](https://github.com/SectionTN/react-native-codepad/issues).

## License

MIT. Each language package includes the license of its grammar and its queries.

---

<p align="center">Made by <a href="https://github.com/SectionTN">SectionTN</a></p>
