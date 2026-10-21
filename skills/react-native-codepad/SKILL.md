---
name: react-native-codepad
description: Adds and wires native code editors in React Native and Expo apps with react-native-codepad, covering install, language packages, CodeEditor props, ref methods, events, themes, search, keyboard toolbars and editors nested in a ScrollView. Use when adding a code editor, a syntax highlighted input or a find bar to a React Native app, or when code uses CodeEditor, CodeEditorRef or a react-native-codepad-lang-* package.
license: MIT
compatibility: React Native 0.81+ on the New Architecture, iOS 17+, Android 7+ (API 24). Needs a native rebuild; Expo Go cannot load it.
metadata:
  repository: https://github.com/SectionTN/react-native-codepad
  docs: https://reactnativecodepad.pages.dev/
---

# react-native-codepad

- **IS:** installing react-native-codepad and building screens around its `CodeEditor`: languages, themes, the ref API, events, search, keyboard handling and layout.
- **IS NOT:** a WebView editor (Monaco, CodeMirror) or a `TextInput` wrapper. The editor is a native view with its own engine in Kotlin and Swift, so `TextInput` habits (controlled `value`, style padding, `onChangeText` for everything) do not carry over.

The installed package ships its API contract at `node_modules/react-native-codepad/src/types.ts`. Read it before using a prop or method this file does not name; it is the source of truth over anything here. The full docs as one text file: https://reactnativecodepad.pages.dev/llms-full.txt

## Install

```sh
npm install react-native-codepad react-native-nitro-modules react-native-codepad-lang-javascript
```

- One `react-native-codepad-lang-<id>` package per highlighted language. Ids: `c`, `css`, `go`, `html`, `java`, `javascript`, `json`, `kotlin`, `markdown`, `python`, `rust`, `swift`, `tsx`, `typescript`, `yaml`. Use the project's package manager.
- iOS deployment target 17.0: `platform :ios, '17.0'` in `ios/Podfile`, or on Expo `["expo-build-properties", { "ios": { "deploymentTarget": "17.0" } }]` in the `app.json` plugins.
- Rebuild the native app after adding or removing any of these packages: `cd ios && pod install`, then run the app again. On Expo: `npx expo prebuild`, then `npx expo run:ios` or `run:android`. A Metro reload is not enough.

Installing packages and rebuilding are local and safe to run without asking. The work is done when the app builds and the editor renders highlighted text, not when the TypeScript compiles.

## Minimal screen

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
      onChange={(e) => console.log(e.origin, e.start, e.end, e.text)}
    />
  );
}
```

## How the API behaves

- **Uncontrolled.** `initialValue` is read once. Replace the document with `await editor.current?.setText(text)` and read it with `getText()` when saving. There is no `value` prop.
- **Reads are sync, writes are async.** `getText()`, `getSelection()`, `getLine()`, `getCursorRect()` return directly; `setText()`, `replaceRange()`, `insertText()`, `undo()`, `setSearch()` and the rest return promises. Ref calls are valid from `onReady`; before it they act on an empty document.
- **Offsets are UTF-16 code units**, like JavaScript string indices. Lines and columns start at 0, ranges are `[start, end)`. Convert with `offsetToPosition()` and `positionToOffset()`.
- **`onChange` carries a delta** (`start`, `end`, `text`, `origin`, `revision`). `onChangeText` copies the whole document on every keystroke; use it only for small documents, and `getText()` on save otherwise.
- **`typeText()` vs `insertText()`.** `typeText()` and `deleteBackward()` take the keyboard path (auto close, auto indent, undo coalescing, origin `input`, no-op under `readOnly`). `insertText()` and `replaceRange()` are raw edits with origin `api`. Toolbar keys want `typeText()`.
- **`readOnly`** blocks the keyboard, the keyboard path methods, `cut()` and `paste()`. `setText()`, `replaceRange()`, `insertText()` and search replace still edit; selection, `copy()` and `moveCaret()` keep working.

## Gotchas

- **The editor needs a height**: `flex: 1` in a column or an explicit `height`. It has no intrinsic height to grow into.
- **Missing language package means plain text**, with one console warning and no error. If highlighting is absent, check the package is installed and the app was rebuilt. `Codepad.availableLanguages()` lists what is linked. Use `markdown`, never `markdown_inline`.
- **Object props are compared by identity.** A `theme` or `contentInsets` literal in JSX crosses to native on every render. Hoist it to module scope or `useMemo` it. Callback props are wrapped once, so inline arrows are fine.
- **Style padding is ignored.** Use `contentInsets` (dp on Android, points on iOS) for space inside the scroll area, for example under a floating toolbar.
- **Keyboard:** pass `avoidKeyboard` so the content follows the keyboard animation; the overlap is added on top of `contentInsets.bottom`. On Android it does nothing under `adjustPan`, where the window pans instead.
- **Inside a `ScrollView`:** set `scrollEnabled={false}`, `softWrap`, feed `onContentSizeChange` height back into `style` with `Math.ceil`, leave `avoidKeyboard` off and scroll the page yourself from `getCursorRect()`. Only for documents of a few hundred lines; a large file needs its own fixed height editor.
- **Search:** `setSearch()` rejects when a regex does not compile, so wrap it in `try`. `replaceCurrent()` resolves `false` until a match is selected, so call `findNext()` first. Replacement text is literal (no `$1`).
- **Expo Go cannot run it.** A development build is required.

## Recipes

Read [references/recipes.md](references/recipes.md) when building one of these: a custom theme, a keyboard toolbar with react-native-keyboard-controller, a find and replace bar, or an auto height editor inside a `ScrollView`.
