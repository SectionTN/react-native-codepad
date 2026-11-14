---
title: Contributing
description: The development loop, the commands and the conventions.
sidebar_position: 2
---

The repository is a yarn workspace: the library at the root, the example app under `example/`, one package per language under `languages/` and this site under `website/`. You need Node 24 and yarn 4 through corepack, JDK 17, the Android SDK with an emulator, and Xcode 26 or later with an iOS simulator.

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

The Kotlin core, the keyboard protocol and the syntax engine are tested on the JVM, so no device is needed. The syntax tests use a host build of the C++ core, tree-sitter and the grammars. Build it once, and again after a change under `cpp/`:

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

Every build, bench and instrumented run uses the `debugOptimized` variant, a debug app over release library modules. Its numbers stay close to a release build.

| Command | Does |
| --- | --- |
| `yarn test:device [-e class codepad.example.X]` | Installs both APKs and runs the instrumented tests |
| `yarn bench:scroll [swipes]` | Prints the frame times and the janky count over flings of the benchmark document |
| `yarn bench:memory` | Prints the Java and native heaps and the PSS |
| `yarn bench:typing [chars]` | Types through `adb shell input` and prints the key handler, key to paint and parse percentiles |
| `yarn ime:record <name>` | Records the keyboard's input connection calls into `tests/ime/<name>.json`, which `yarn test:android` replays |

Run benches on AC power. On battery, macOS slows the emulator down.

## Languages

| Command | Does |
| --- | --- |
| `yarn gen:languages [id...]` | Regenerates the packages from `languages/grammars.json` and the [language packages](/reference/languages/) page |
| `yarn gen:report` | Lists every predicate each language's queries use, with counts |

Generated files are never edited by hand. CI regenerates them and fails on a diff.

### Add a language

1. Add an entry to `languages/grammars.json`: the id, which must match the nvim-treesitter query directory, the grammar repository and commit, and the grammar directories. When the grammar isn't MIT, add `license` with its SPDX id, and the package then declares both licenses.
2. Run `yarn gen:languages <id>`. It fetches the grammar and the queries, translates the predicates and writes the package. It drops each pattern it can't translate with a warning, and `yarn gen:report` lists every predicate per language.
3. Add each new grammar to `tests/swift/HostGrammars.swift`. Give it a one-line snippet in `LanguagePackagesTest.kt`, `tests/swift/LanguageSmokeTests.swift`, and the example app's `LanguagesTest.kt` and `LanguagesTests.swift`.
4. Run `yarn host:treesitter && yarn test:android` to compile the queries against the parser on the JVM.
5. Delete `~/Library/Caches/org.swift.swiftpm/manifests`, then run `yarn test:swift` to compile the queries on macOS. SwiftPM caches the scan that finds the grammar sources, so without this step the new package fails to link.
6. Run `yarn test:device -e class codepad.example.LanguagesTest` to load the package through the real view on an emulator.

A grammar update is a `rev` change in `languages/grammars.json` followed by the same steps.

## iOS

The Swift core, input, syntax and layout layers build as a Swift package at the root and are tested on macOS, so no simulator is needed:

```sh
yarn test:swift
swift test --filter CodepadTests.DocumentTests
```

For the simulator loop, start Metro and run the example on an iOS simulator. Run `bundle exec pod install` in `example/ios` after a change to a podspec, a Nitro spec or a dependency.

```sh
yarn example start --port 8081
yarn example ios --device <udid>
```

| Command | Does |
| --- | --- |
| `yarn test:ios [-only-testing:CodepadTests/<Class>]` | Runs the view and input suites on the simulator. `CODEPAD_IOS_UDID` picks the device |
| `yarn bench:ios scroll`, `memory`, `typing` | Collects the same measures as Android on the simulator, for regressions only |
| `yarn ime:record:ios <name>` | Records the keyboard's `UITextInput` calls into `tests/ime-ios/<name>.json`, which `yarn test:swift` replays |

## This site

`yarn docs` serves the site with live reload and `yarn docs:build` builds it. The pages live under `website/docs`. The reference pages are written by hand, and a test under `tests/docs` fails when a prop, method or type of `src/types.ts` is missing from them. A push to `main` that touches `website/` deploys the site to Cloudflare Pages.

## Conventions

- The layers are the ones on the [architecture](/internals/architecture/) page: `core` holds thin facades over the C++ core, `input` is pure Kotlin and pure Swift, and Nitro code lives only in `com.margelo.nitro.codepad`, `ios/Codepad/nitro` and `src/specs`.
- UTF-16 offsets, half open ranges and 0 based lines and columns, everywhere.
- Tests first: a vector or a JUnit and XCTest case for engine behavior, a jest case for the wrapper, and a keyboard recording for a keyboard bug.
- Biome formatting, conventional commits with an imperative subject under 72 characters, and comments of one to three lines for platform quirks and invariants only.
- Pull requests run `lint`, `test`, `test-swift`, `test-core-sanitizers`, `docs`, `build-library`, `build-android` and `build-ios` in CI. `test-core-sanitizers` runs the Swift tests under AddressSanitizer and ThreadSanitizer.

[CONTRIBUTING](https://github.com/SectionTN/react-native-codepad/blob/main/CONTRIBUTING.md) in the repository is the short version of this page.
