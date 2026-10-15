# Contributing

Bug reports, questions and pull requests are welcome. The project follows the [code of conduct](./CODE_OF_CONDUCT.md).

## The loop

The repository is a yarn workspace: the library at the root, the example app under `example/`, one package per language under `languages/` and the docs site under `website/`. Node 24 with yarn 4 through corepack, JDK 17 and the Android SDK with an emulator, and Xcode 16 or newer with an iOS 17 simulator for the iOS side.

```sh
yarn                                       # install
yarn lint && yarn typecheck && yarn test   # Biome, tsc, jest and the node tests
yarn host:treesitter && yarn test:android  # the Kotlin suite on the JVM, vectors and Gboard recordings included
yarn test:swift                            # the Swift suites on macOS, vectors and iOS keyboard recordings included
yarn example start --port 8081             # Metro
yarn example android                       # the example on the running emulator, debugOptimized
yarn example ios --udid <udid>             # the example on an iOS simulator
yarn test:device                           # the instrumented tests on the emulator
yarn test:ios                              # the XCTest suites on the simulator
yarn gen:languages                         # regenerate the language packages
yarn docs                                  # the docs site with live reload
```

The [contributing page](https://sectiontn.github.io/react-native-codepad/internals/contributing/) of the docs site has the full loop: the benches, the keyboard recorder, the host tree-sitter build, iOS, and what every command prints.

## Conventions

- Conventional commits with an imperative subject under 72 characters; a body only when the reason is not in the diff. commitlint checks every commit.
- Biome formats and lints; `yarn format` fixes what it can, and lefthook runs it on staged files.
- Generated files are never edited by hand: everything under `languages/<id>/` comes from `yarn gen:languages`, `nitrogen/generated` and `src/specs/CodeEditorViewConfig.ts` from `yarn nitrogen`, the language packages page of the site from the generator. CI regenerates and fails on a diff.
- Tests come with the change: a vector in `tests/vectors` or a JUnit case for engine behavior, a jest case for the wrapper, a recording in `tests/ime` or `tests/ime-ios` for a keyboard bug.
- UTF-16 offsets, half open ranges, 0 based lines and columns, everywhere. Comments are one to three lines and state platform quirks and invariants, nothing else.

## Pull requests

- One change per pull request, with the reason in the description.
- `yarn lint`, `yarn typecheck`, `yarn test`, `yarn test:android` and `yarn test:swift` pass locally; CI runs them plus the Android and iOS example builds and the docs build.
- A change to the public API updates `src/types.ts`, the reference pages under `website/docs/reference/` (a test fails otherwise) and the README when the quick start is affected.
- A keyboard or layout change was tried on a device, an emulator or the simulator; say which, with the keyboard for input changes.
- Open an issue first for a change to the API or to the engine's behavior, so the design is agreed before the code.
