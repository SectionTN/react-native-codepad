# react-native-codepad

A native code editor component for React Native, with its own text engine on each platform and tree-sitter syntax highlighting, bound through Nitro Views.

Pre-release. Android first, iOS when the Swift side lands.

## Development

- `yarn` installs the workspace.
- `yarn lint`, `yarn format`, `yarn typecheck`, `yarn test` run Biome, tsc, jest and the generator tests.
- `yarn nitrogen` regenerates the Nitro bindings and `src/specs/CodeEditorViewConfig.ts`.
- `yarn test:android` runs the Kotlin unit tests on the JVM through the example app's Gradle project.
- `yarn host:treesitter` builds the host tree-sitter library those tests use for syntax cases.
- `yarn gen:languages` regenerates the language packages under `languages/`, `yarn gen:report` prints the query predicate report.
- `yarn example android` runs the example app on a connected device.
