---
title: Languages
description: The language packages, the language prop, the aliases and the injections.
sidebar_position: 1
---

Each language is a compiled tree-sitter grammar plus the nvim-treesitter queries, shipped as its own npm package. The core has no language built in, so without a package every document is plain text.

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

Pass the id as `language`. The [reference](/reference/languages/) lists each grammar's revision and capture names.

Use `markdown`, not `markdown_inline`: the inline grammar is reached through injection.

`Codepad.availableLanguages()` lists the installed packages:

```ts
import { Codepad } from 'react-native-codepad';

const installed = Codepad.availableLanguages();
// ['javascript', 'markdown', 'markdown_inline', ...]
```

## Plain text fallback

A `language` with no installed package renders as plain text in `foreground` and logs one warning. Nothing throws. Switching `language` on a live editor reparses the document.

## Injections

A grammar's injection query hands ranges to another language: fenced blocks in markdown, `<script>` and `<style>` in html, `css` and `html` tagged templates in javascript, markdown front matter. The name comes from the document or from the query, is lowercased, and goes through this table before the registry looks for a package:

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

A name with no package keeps the host language's colors. `cpp`, `bash`, `sh`, `sql`, `graphql`, `text` and the rest of nvim-treesitter's list stay silent, and any other name logs the fallback warning once.

- Injections go one level deep: a javascript block inside markdown highlights, an html template inside that block does not.
- `${...}` substitutions inside a tagged template are parsed by the injected language.
- Injected trees survive edits and reparse only when their own range changed. The [performance guide](/guides/performance/) has the numbers.

## Size

One native library per ABI, loaded on first use. On `arm64-v8a` in a release build:

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

An app bundle splits libraries per ABI, so a device downloads one set.

## Adding a language

Packages are generated from `languages/grammars.json` in the repository, never written by hand:

1. Add an entry: the id (it must match the nvim-treesitter query directory), the grammar repository and commit, and the grammar directories.
2. Run `yarn gen:languages <id>`. It fetches the grammar and the queries, translates the predicates and writes the package. Patterns it cannot translate are dropped with a warning each, and `yarn gen:report` lists every predicate per language.
3. Run `yarn host:treesitter && yarn test:android` to compile the queries against the parser on the JVM.
4. Run `yarn test:device -e class codepad.example.LanguagesTest` to load the package through the real view on an emulator.

CI regenerates every package and fails on any diff. A grammar bump is a `rev` change followed by the same steps.

A third party package works when it follows the convention: the npm name `react-native-codepad-lang-<id>`, a Kotlin `LanguageProvider` at `me.sectiontn.codepad.lang.<id>` with a keep rule, an asset marker at `codepad-languages/<id>`, and a parser built against tree-sitter 0.26 (ABI 13 to 15).
