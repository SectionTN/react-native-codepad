# react-native-codepad

A native code editor component for React Native. The document, layout, selection, undo and keyboard input live in Kotlin and Swift on top of the platform text APIs, syntax highlighting is tree-sitter on a background thread with one language per package, and the component is bound through Nitro Views. No WebView, no `TextInput` underneath.

## Status

Pre-release. The Android editor is complete and measured; the iOS editor is in progress and the first npm release, `0.1.0`, ships with it. The packages are not on npm yet. The [roadmap](https://sectiontn.github.io/react-native-codepad/internals/roadmap/) lists what comes next and what is deliberately out of the first version.

## Features

- Editing with selection handles, the edit menu, soft keyboard composition, undo and redo with typing coalescing, auto indent, auto closing brackets and quotes, bracket matching, a read only mode and a placeholder.
- Hardware keyboards with the full key table, and a toolbar API (`moveCaret`, `typeText`, `deleteBackward`, `deleteForward`) that drives the same paths from JavaScript.
- Line numbers, soft wrap or horizontal scrolling, scroll to line, reveal selection, caret rect and visible lines for toolbars, content insets.
- `avoidKeyboard`: the editor follows the keyboard animation itself, frame by frame.
- Search with literal or regex queries, case and whole word options, find next and previous, replace one or all, painted matches.
- Incremental tree-sitter highlighting with injections for fenced blocks, embedded script and style and tagged templates; fifteen language packages, install only what you use.
- Three themes keyed by capture name with prefix lookup, so nvim-treesitter themes port by renaming.
- A delta `onChange`, sync readers on the JS thread, async writers that resolve once applied; UTF-16 offsets, the same as JavaScript strings.

## Install

React Native 0.81 or newer with the New Architecture, Android API 24. Install the core, Nitro Modules and one package per language:

```sh
yarn add react-native-codepad react-native-nitro-modules react-native-codepad-lang-javascript
```

Or:

```sh
npm install react-native-codepad react-native-nitro-modules react-native-codepad-lang-javascript
```

Then rebuild the app, since native code changed:

```sh
yarn react-native run-android
```

Expo works through `npx expo prebuild` or a development build, with no config plugin; Expo Go cannot load native code. Autolinking covers the core and every language package. See [installation](https://sectiontn.github.io/react-native-codepad/start/installation/) for the details and the iOS state.

## Quick start

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

The ref has sync readers (`getText()`, `getSelection()`, `getCursorRect()`) and async writers (`setText()`, `replaceRange()`, `undo()`, `setSearch()`). Everything is valid from `onReady`.

## Documentation

https://sectiontn.github.io/react-native-codepad/ has the guides (languages, themes, keyboard, nested scroll, search, hardware keyboard, performance), the full API reference and the internals.

## Platforms

| Platform | State |
| --- | --- |
| Android | Complete: API 24 and up, measured against the targets in the [performance guide](https://sectiontn.github.io/react-native-codepad/guides/performance/) |
| iOS | In progress: the package builds and links with a stub view; the editor renders in a later release |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development loop and the conventions.

## License

MIT. Each language package ships the license of its grammar and a third party notices file for the nvim-treesitter queries.
