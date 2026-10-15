---
title: Languages
description: Language packages, the language prop, aliases, injections and how a grammar gets added.
sidebar_position: 1
---

Highlighting is tree-sitter: each language is a compiled grammar plus the highlight and injection queries from nvim-treesitter, shipped as its own npm package so an app only carries the parsers it uses. The core has no language built in; without a package every document is plain text.

## Packages and ids

| `language` | Package |
| --- | --- |
| `c` | react-native-codepad-lang-c |
| `css` | react-native-codepad-lang-css |
| `go` | react-native-codepad-lang-go |
| `html` | react-native-codepad-lang-html |
| `java` | react-native-codepad-lang-java |
| `javascript` | react-native-codepad-lang-javascript |
| `json` | react-native-codepad-lang-json |
| `kotlin` | react-native-codepad-lang-kotlin |
| `markdown` | react-native-codepad-lang-markdown |
| `python` | react-native-codepad-lang-python |
| `rust` | react-native-codepad-lang-rust |
| `swift` | react-native-codepad-lang-swift |
| `tsx` | react-native-codepad-lang-tsx |
| `typescript` | react-native-codepad-lang-typescript |
| `yaml` | react-native-codepad-lang-yaml |

Pass the id as the `language` prop. The [language packages reference](/reference/languages/) lists each grammar's repository, revision, scanner and capture names; it is generated from the packages, so it is always current.

The markdown package carries two grammars, `markdown` for blocks and `markdown_inline` for emphasis, links and inline code. Use `markdown`: the inline grammar is reached through injection and is not meant as a `language` value on its own.

`Codepad.availableLanguages()` returns the grammar names of the installed packages, read from a marker each package ships in the app's assets. Third party packages that follow the naming convention appear there too, and `markdown_inline` is in the list whenever markdown is installed.

```ts
import { Codepad } from 'react-native-codepad';

const installed = Codepad.availableLanguages();
// ['javascript', 'markdown', 'markdown_inline', ...]
```

## Plain text fallback

A `language` with no installed package, a package whose parser was built for another tree-sitter ABI, or a query that fails to compile all end the same way: the document renders in `foreground`, one warning goes to the log, nothing throws and no event fires. Switching `language` on a live editor reparses the document with the new grammar.

## Injections

A grammar's injection query marks ranges that belong to another language: fenced blocks in markdown, `<script>` and `<style>` in html, a `css` or `html` tagged template in javascript, the front matter of a markdown file. The engine parses each range set with the named language and paints its spans in place.

The name comes from the query or from the document (a fence info string, a template tag). It is lowercased and resolved through an alias table before the registry looks for a package:

| Name in the source | Resolves to |
| --- | --- |
| `js`, `jsx`, `mjs`, `cjs` | `javascript` |
| `ts`, `mts`, `cts` | `typescript` |
| `py`, `python3` | `python` |
| `kt`, `kts` | `kotlin` |
| `rs` | `rust` |
| `golang` | `go` |
| `yml` | `yaml` |
| `jsonc`, `json5` | `json` |
| `htm`, `xhtml` | `html` |
| `md` | `markdown` |
| `h` | `c` |

These names are never injected, so their ranges keep the host language's colors without a warning: `cpp`, `c++`, `cc`, `hpp`, `objc`, `bash`, `sh`, `shell`, `zsh`, `console`, `text`, `txt`, `plain`, `regex`, `jsdoc`, `comment`, `luap`, `printf`, `styled`, `angular`, `groq`, `graphql`, `glimmer`, `sql`, `c_sharp`. Any other name is tried as a package id; a fence tagged `ruby` without a ruby package is plain text, like the fallback above.

What the engine does and does not do:

- One level. The injected language's own injection query does not run, so a javascript block inside markdown highlights, but an html template inside that block does not.
- `injection.include-children` is always on: an injected range includes its child nodes, so `${...}` substitutions inside a tagged template are parsed by the injected language. nvim-treesitter excludes them unless the query asks; this is a deliberate difference.
- `#offset!` directives apply when their row deltas are zero, which trims the backticks off a template string or the markers off front matter. Row offsets are ignored.
- `injection.combined` ranges parse as one tree, which is how a markdown document's html blocks form one document.
- Injected trees survive edits. Each one is edited along with the host document and reparsed incrementally when its range still matches, so typing in one fenced block of a long markdown file reparses that block and nothing else. The [performance](/guides/performance/) page has the numbers.

## Size

Each package ships one native library per ABI, loaded on first use. Sizes for `arm64-v8a` in a release build:

| Package | Library |
| --- | --- |
| kotlin | 5.5 MB |
| swift | 4.0 MB |
| tsx, typescript | 1.4 MB each |
| rust | 1.1 MB |
| markdown | 0.7 MB |
| c | 0.6 MB |
| java, javascript, python | 0.4 MB each |
| go, yaml | 0.2 MB each |
| css | 0.1 MB |
| html, json | under 0.1 MB |

An app bundle splits native libraries per ABI, so a device downloads one set.

## Adding a language

Packages are generated, never written by hand, from `languages/grammars.json` in the repository:

1. Add an entry: the id, the grammar repository and the commit to pin, the grammar directories (`src` for most, two for markdown) and any extra source paths such as a shared scanner header. The id must match the nvim-treesitter query directory, because the queries come from there at the commit the manifest pins.
2. Run `yarn gen:languages <id>`. The generator fetches the grammar and the queries, resolves `; inherits:` headers, translates the predicates it supports (`eq?`, `match?`, `any-of?`, `contains?`, `has-parent?` and `has-ancestor?` with their `not-` and `any-` forms, plus `lua-match?` for the common subset), drops the patterns it cannot translate with a warning for each, then writes the package with its Android and iOS build files, the Kotlin and Swift providers, the embedded queries and a README. `yarn gen:report` prints every predicate each language uses with counts.
3. Run `yarn host:treesitter && yarn test:android`. The JVM smoke test compiles every grammar's queries against its parser and highlights a snippet; a query that names a node type the pinned grammar lacks fails here with tree-sitter's message.
4. Link the package in the example app and run `yarn test:device -e class codepad.example.LanguagesTest` on an emulator, which loads every installed language through the real view.

CI regenerates every package and fails on any diff, so a hand edit never survives. A grammar bump is a `rev` change in the manifest followed by the same steps.

A package that does not come from the generator can still work if it follows the convention the registry uses: the npm name `react-native-codepad-lang-<id>`, a Kotlin class `me.sectiontn.codepad.lang.<id>.<Pascal>Language` implementing `LanguageProvider` with a keep rule, an asset marker at `codepad-languages/<id>`, and a parser built against tree-sitter 0.26 (ABI 13 to 15).
