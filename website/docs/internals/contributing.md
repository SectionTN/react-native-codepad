---
title: Contributing
description: The development loop, the commands and the conventions.
sidebar_position: 2
---

The repository is a yarn workspace: the library at the root, the example app under `example/`, one package per language under `languages/` and this site under `website/`. You need Node 24 and yarn 4 through corepack, JDK 17, the Android SDK with an emulator, and Xcode 16 with an iOS 17 simulator.

```sh
git clone https://github.com/SectionTN/react-native-codepad
cd react-native-codepad
yarn
```

## JavaScript

| Command | Does |
| --- | --- |
| `yarn lint`, `yarn format` | Runs the Biome check, with fixes for `format` |
| `yarn typecheck` | Runs `tsc` over the library, the example, the generator and the tests |
| `yarn test` | Runs jest for the wrapper and `node --test` for the generator, the theme coverage and the docs drift tests |
| `yarn nitrogen` | Regenerates `nitrogen/generated` after a change to a `*.nitro.ts` file. The output is committed |
| `yarn prepare` | Builds the library |

## Android

The Kotlin core, the keyboard protocol and the syntax engine are tested on the JVM, so no device is needed. The syntax tests use a host build of tree-sitter, built once:

```sh
yarn host:treesitter
yarn test:android
```

For the device loop, start Metro and install the example on a running emulator:

```sh
yarn example start --port 8081
adb reverse tcp:8081 tcp:8081
yarn example android
```

Every build, bench and instrumented run uses the `debugOptimized` variant: a debuggable app over release library modules, so the numbers mean something.

| Command | Does |
| --- | --- |
| `yarn test:device [-e class codepad.example.X]` | Installs both APKs and runs the instrumented tests |
| `yarn bench:scroll [swipes]` | Prints the frame times and the janky count over flings of the benchmark document |
| `yarn bench:memory` | Prints the Java and native heaps and the PSS |
| `yarn bench:typing [chars]` | Types through `adb shell input` and prints the key handler, key to paint and parse percentiles |
| `yarn ime:record <name>` | Records the keyboard's input connection calls into `tests/ime/<name>.json`, which `yarn test:android` replays |

## Languages

| Command | Does |
| --- | --- |
| `yarn gen:languages [id...]` | Regenerates the packages from `languages/grammars.json` and the [language packages](/reference/languages/) page |
| `yarn gen:report` | Lists every predicate each language's queries use, with counts |

Generated files are never edited by hand: CI regenerates them and fails on a diff. [Adding a language](/guides/languages/#adding-a-language) has the steps.

## iOS

The Swift core, input, syntax and layout layers build as a Swift package at the root and are tested on macOS, so no simulator is needed:

```sh
yarn test:swift
swift test --filter CodepadTests.DocumentTests
```

For the simulator loop, start Metro and run the example on an iOS 17 simulator. Run `bundle exec pod install` in `example/ios` after a podspec, a Nitro spec or a dependency changed.

```sh
yarn example start --port 8081
yarn example ios --udid <udid>
```

| Command | Does |
| --- | --- |
| `yarn test:ios [-only-testing:CodepadTests/<Class>]` | Runs the view and input suites on the simulator. `CODEPAD_IOS_UDID` picks the device |
| `yarn bench:ios scroll`, `memory`, `typing` | Collects the same measures as Android on the simulator, for regressions only |
| `yarn ime:record:ios <name>` | Records the keyboard's `UITextInput` calls into `tests/ime-ios/<name>.json`, which `yarn test:swift` replays |

## This site

`yarn docs` serves the site with live reload and `yarn docs:build` builds it. The pages live under `website/docs`. The reference pages are written by hand, and a test under `tests/docs` fails when a prop, method or type of `src/types.ts` is missing from them. A push to `main` that touches `website/` deploys the site to Cloudflare Pages.

## Conventions

- The layers are the ones on the [architecture](/internals/architecture/) page: `core` and `input` are pure Kotlin and pure Swift, and Nitro code lives only in `com.margelo.nitro.codepad`, `ios/Codepad/nitro` and `src/specs`.
- UTF-16 offsets, half open ranges and 0 based lines and columns, everywhere.
- Tests first: a vector or a JUnit and XCTest case for engine behavior, a jest case for the wrapper, and a keyboard recording for a keyboard bug.
- Biome formatting, conventional commits with an imperative subject under 72 characters, and comments of one to three lines for platform quirks and invariants only.
- Pull requests run `lint`, `test`, `test-swift`, `docs`, `build-library`, `build-android` and `build-ios` in CI.

[CONTRIBUTING](https://github.com/SectionTN/react-native-codepad/blob/main/CONTRIBUTING.md) in the repository is the short version of this page.
