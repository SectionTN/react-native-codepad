---
title: Contributing
description: The development loop, the commands and the conventions.
sidebar:
  order: 2
---

The repository is a yarn workspace: the library at the root, the example app under `example/`, one package per language under `languages/` and this site under `website/`. Node 24 and yarn 4 through corepack, JDK 17, the Android SDK with an emulator, and Xcode for the iOS build.

```sh
git clone https://github.com/SectionTN/react-native-codepad
cd react-native-codepad
yarn
```

## JavaScript

| Command | Does |
| --- | --- |
| `yarn lint`, `yarn format` | Biome check, Biome check with fixes |
| `yarn typecheck` | `tsc` over the library, the example, the generator and the tests |
| `yarn test` | jest for the wrapper, then `node --test` for the generator, the theme coverage test and the docs drift test |
| `yarn nitrogen` | Regenerates `nitrogen/generated` and `src/specs/CodeEditorViewConfig.ts` after a change to a `*.nitro.ts` file; the output is committed |
| `yarn prepare` | Builds the library with react-native-builder-bob |

## Android

The Kotlin core, the keyboard protocol and the syntax engine are tested on the JVM, no device needed. The syntax tests use a host build of tree-sitter with every grammar linked in, built once and rebuilt only when a grammar changes:

```sh
yarn host:treesitter
yarn test:android
```

`yarn test:android` runs `testDebugUnitTest` of the library module through the example app's Gradle project and is quiet on success; the reports are under `android/build/test-results/testDebugUnitTest/`. The suite covers the shared vectors, the Gboard recordings, the document, layout and viewport classes, the predicate evaluator, injections and the smoke test over all sixteen grammars.

For the device loop, start Metro and install the example on a running emulator:

```sh
yarn example start --port 8081
adb reverse tcp:8081 tcp:8081
yarn example android
```

Every Android build, bench and instrumented run uses the `debugOptimized` variant: a debuggable app with Metro and the debug switch, library modules and CMake built as release, so the numbers mean something. `yarn example build:android` compiles only.

| Command | Does |
| --- | --- |
| `yarn test:device [-e class codepad.example.X]` | Builds both APKs, installs them and runs the instrumented tests through `am instrument` |
| `yarn bench:scroll [swipes]` | Flings the benchmark document and prints frame times and the janky frame count |
| `yarn bench:memory` | Prints the Java and native heaps and the PSS of the app |
| `yarn bench:typing [chars]` | Types into the focused editor through `adb shell input` and prints the key handler plus draw and the key to paint percentiles, plus the parse latency and injection reuse counts when a document with injections is open |
| `yarn ime:record <name>` | Records the keyboard's input connection calls into `tests/ime/<name>.json` while you type in the example; Ctrl-C ends it, `yarn test:android` replays it |

`adb shell settings put global codepad_debug 1` turns on the recorder and the paint log in debuggable builds; the scripts set and clear it themselves.

## Languages

| Command | Does |
| --- | --- |
| `yarn gen:languages [id...]` | Regenerates the packages under `languages/` from `languages/grammars.json` and rewrites the [language packages](/react-native-codepad/reference/languages/) reference page |
| `yarn gen:report` | Prints every predicate and directive each language's queries use, with counts |

Generated files are never edited by hand; CI regenerates and diffs them. The [languages guide](/react-native-codepad/guides/languages/#adding-a-language) walks through adding one.

## iOS

`yarn example ios` builds and runs the example on the simulator with the Swift stub, after `pod install` in `example/ios` when a Nitro spec or a pod changed. CI compiles it on every pull request so the iOS side stays green while the editor is written.

## This site

`yarn docs` serves it with live reload, `yarn docs:build` builds it. The pages live under `website/src/content/docs`; the reference pages are hand written and a test under `tests/docs` fails when a prop, method or exported type of `src/types.ts` is missing from them. The language packages page is generated. Pushes to `main` that touch `website/` deploy to GitHub Pages.

## Conventions

- Layers and their dependencies as on the [architecture](/react-native-codepad/internals/architecture/) page: `core` and `input` are pure Kotlin, Nitro code lives only in `com.margelo.nitro.codepad` and `src/specs`.
- UTF-16 offsets, half open ranges, 0 based lines and columns, everywhere.
- Tests first: a vector or a JUnit case for engine behavior, a jest case for the wrapper, a Gboard recording for a keyboard bug.
- Every callback prop in `src/CodeEditor.tsx` is wrapped once; native never emits events from prop setters during the first batch.
- Biome formatting, conventional commits with an imperative subject under 72 characters, comments of one to three lines for platform quirks and invariants only.
- Pull requests go through the CI jobs: `lint` (Biome, tsc, the regeneration diff), `test` (jest and node), `docs` (the site build), `build-library`, `build-android` (the JVM suite with the host build, the example APK, the instrumented test compile) and `build-ios`.

The [CONTRIBUTING](https://github.com/SectionTN/react-native-codepad/blob/main/CONTRIBUTING.md) file in the repository is the short version of this page.
