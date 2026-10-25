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

After adding the package or changing native configuration, rebuild your native application. Installing the JavaScript package alone does not update an already-installed native app.

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

The editor needs a parent layout that gives it space to render. For example, `style={{ flex: 1 }}` works when its parent has a defined size.

## Language Support

Syntax highlighting is provided by separate `react-native-codepad-lang-*` packages. Install the package for each language your app uses, then set `language` to that package's language identifier.

For example, the JavaScript package is installed in the setup command above and used with `language="javascript"`. See the [Language Reference](https://reactnativecodepad.pages.dev/reference/languages/) for supported languages, package names, and identifiers.

You can check which languages are available at runtime:

```tsx
import { Codepad } from 'react-native-codepad';

const languages = Codepad.availableLanguages();
```

## API

`CodeEditor` takes the usual `View` props, plus the ones below. The [reference](https://reactnativecodepad.pages.dev/reference/props/) lists every prop, method, event and type.

### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `initialValue` | `string` | `''` | Sets the initial text. It is read once, so use `setText()` to replace the document later. |
| `language` | `string` | undefined | The id of an installed language package. Without it the editor shows plain text. |
| `theme` | `Theme` | `githubLight` | The colors. `githubDark` and `oneDark` ship too, and a theme is a plain object you can write yourself. |
| `fontSize` | `number` | `14` | In dp on Android and points on iOS. |
| `fontFamily` | `string` | Platform default | Sets the editor font family. |
| `lineHeight` | `number` | `1.4` | Controls line height. |
| `softWrap` | `boolean` | `false` | Wraps long lines. Off means horizontal scrolling. |
| `lineNumbers` | `boolean` | `true` | Shows the line number gutter. |
| `readOnly` | `boolean` | `false` | Hides the keyboard and refuses edits. Selection and copy keep working. |
| `highlightActiveLine` | `boolean` | `true` | Highlights the current line. |
| `matchBrackets` | `boolean` | `true` | Highlights matching brackets. |
| `autoCloseBrackets` | `boolean` | `true` | Closes pairs as you type and skips over a closer you type yourself. |
| `autoIndent` | `boolean` | `true` | Enables automatic indentation. |
| `insertSpaces` | `boolean` | `true` | Inserts spaces instead of tab characters. |
| `tabSize` | `number` | `4` | The width of one indentation level. |
| `placeholder` | `string` | — | Sets placeholder text. |
| `scrollEnabled` | `boolean` | `true` | Enables or disables editor scrolling. |
| `contentInsets` | `ContentInsets` | — | Configures the editor's content insets. |
| `avoidKeyboard` | `boolean` | `false` | Adds the keyboard overlap to the bottom inset on every frame of the keyboard animation. |
| `suggestions` | `Suggestions` | — | Controls native keyboard suggestions. See the reference for platform-specific behavior. |
| `autoFocus` | `boolean` | `false` | Requests focus when the editor is initialized. |
| `onChange` | `(event) => void` | — | Called after every edit with the replaced range, new text and its origin. |
| `onChangeText` | `(text) => void` | — | Called with the complete document text after a change. |
| `onSelectionChange` | `(selection) => void` | — | Called when the caret or selection moves. |
| `onReady` | `() => void` | — | Called when the editor is ready. |
| `onFocus` / `onBlur` | `() => void` | — | Report focus changes. |
| `onScroll` | `(...) => void` | — | Reports editor scrolling. |
| `onContentSizeChange` | `(...) => void` | — | Reports content-size changes. |

### Methods

| Method | Description |
| --- | --- |
| `getText()`, `getSelection()`, `getLineCount()` | Read the document or current selection. |
| `getTextInRange()`, `getLength()`, `getLine()`, `getRevision()` | Read a range, document length, a line, or the current revision. |
| `setText(text)`, `replaceRange(range, text)`, `insertText(text)` | Change the document. Each resolves once the edit is applied. |
| `setSelection(selection)`, `selectAll()`, `scrollToLine(line)`, `revealSelection()` | Move the selection and the viewport. |
| `offsetToPosition()`, `positionToOffset()`, `getCursorRect()`, `getVisibleLines()` | Convert positions or inspect the caret and visible lines. |
| `undo()`, `redo()`, `canUndo()`, `canRedo()` | Undo or redo edits and check whether those actions are available. |
| `indent()`, `outdent()`, `cut()`, `copy()`, `paste()` | Editing and clipboard operations. |
| `moveCaret(direction)`, `typeText(text)`, `deleteBackward()`, `deleteForward()` | The toolbar API. These use the editor's editing path. |
| `setSearch(query)`, `findNext()`, `findPrevious()`, `replaceCurrent(text)`, `replaceAll(text)`, `clearSearch()` | Search, replace matches, and clear the search state. |
| `focus()`, `blur()`, `isFocused()` | Control or inspect focus. |

See the [complete API reference](https://reactnativecodepad.pages.dev/reference/props/) for exact signatures, options, event types, and return values.

### Important API Behavior

- **`initialValue` is not a controlled value.** It is read when the editor is initialized. Use `setText()` to replace the document after initialization.
- **Choose the change callback for your use case.** `onChange` provides edit details, including the replaced range and origin. `onChangeText` provides the full document after each change, which can be more expensive for large files.
- **Offsets and ranges have specific conventions.** Offsets use UTF-16 code units; ranges are half-open (`[start, end)`), with the start included and the end excluded. Line and column positions are zero-based.
- **Search supports literal and regular-expression queries.** Regex queries use the ICU dialect. Invalid expressions are rejected, and replacement text is treated literally.

## Keyboard and Scrolling

For editors that share a screen with other scrollable content, review `scrollEnabled` and the layout of the parent scroll container. To manage keyboard overlap, check `avoidKeyboard` and `contentInsets`; the right setup depends on your screen layout.

See the [props reference](https://reactnativecodepad.pages.dev/reference/props/) for the available options and behavior.

## Coding Agents

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
