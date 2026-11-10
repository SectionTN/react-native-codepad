---
title: Custom languages
description: Highlight a language CodePad doesn't ship, from your own tree-sitter grammar, without publishing it.
sidebar_position: 1.5
---

A custom language is a language package that you build from your own tree-sitter grammar, so the editor can highlight a language CodePad doesn't ship.

The package stays in your project. CodePad builds it from your grammar folder and doesn't publish it.

## Prepare the grammar

Run `tree-sitter generate` with tree-sitter 0.26 in your grammar folder. The command reads this layout:

```text
my-grammar/
  package.json          optional, gives the version and the author
  src/
    parser.c
    scanner.c           optional
    tree_sitter/
  queries/
    highlights.scm
    injections.scm      optional
```

The parser must use ABI 13 to 15, which is what tree-sitter 0.26 writes. A scanner must be written in C, and every file it includes must be inside `src/`.

## Build the package

Run the command that ships with `react-native-codepad` from your app's root:

```sh
npx react-native-codepad language ./my-grammar
```

It writes the package to `modules/codepad-lang-<id>`, where `<id>` is the name in the parser's `tree_sitter_<id>` function. The package is private and `UNLICENSED`. Its peer dependency accepts the CodePad version that built it and any later release with the same minor version.

| Flag | Default | What it sets |
| --- | --- | --- |
| `--id <id>` | The parser's name | The value you pass to `language` |
| `--out <dir>` | `modules/codepad-lang-<id>` | The folder the package is written to |
| `--name <name>` | `codepad-lang-<id>` | The npm name in the package's `package.json` |

Run the command again after you change the grammar or its queries, and after you upgrade CodePad. It replaces the package it wrote before.

The command stops with a message, and doesn't write anything, when:

- the id doesn't start with a lowercase letter, or holds anything other than lowercase letters, digits and underscores
- the id is a Kotlin keyword or the id of a language CodePad ships
- a query uses a predicate the editor can't run, or starts with an `; inherits:` line
- the scanner is C++ (`scanner.cc`) or includes a file from outside `src/`
- the output folder exists and the command didn't write it

## Link it in your app

In an Expo app, autolinking picks up every package under `modules/`, and you don't add a dependency entry. In a bare React Native app, add the package as a local dependency:

```json title="package.json"
{
  "dependencies": {
    "codepad-lang-mylang": "file:./modules/codepad-lang-mylang"
  }
}
```

Rebuild the app. On iOS, run `pod install` first.

:::caution
On Android, React Native reuses its autolinking result until a lockfile changes, so the first build after you add a folder to `modules/` can leave the package out. Delete `android/build/generated/autolinking/autolinking.json` once and build again.
:::

Pass the id to the editor:

```tsx
<CodeEditor language="mylang" />
```

`Codepad.availableLanguages()` lists the id once the rebuilt app is running.

## Queries

Each capture in `highlights.scm` takes the theme style of the same name, so `@keyword` paints in `keyword` and `@string.special` falls back to `string`. The [themes guide](/guides/themes/) lists the keys.

The editor runs the `eq?`, `match?`, `any-of?`, `contains?`, `has-parent?` and `has-ancestor?` predicates, with their `not-` and `any-` forms. `lua-match?` and `vim-match?` patterns are converted to `match?`.

A highlights query that references a node the grammar doesn't have makes the whole language fall back to plain text. Check each query against a sample file with `tree-sitter query queries/highlights.scm sample.mylang` before you build.

`injections.scm` can hand a range to any installed language. A custom language whose id is `sql`, `bash`, `graphql` or another name CodePad never injects on its own is injected too, for example in a Markdown code block.

## Class names

The editor looks for a class named after the id: `me.sectiontn.codepad.lang.<id>.<Id>Language` on Android and `CPLang<Id>` on iOS, where `<Id>` is the id in PascalCase, split on `_`. The command writes both, so a package built with it needs nothing else.
