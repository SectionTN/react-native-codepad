---
title: Languages
description: The language packages, the language prop, the aliases and the injections.
sidebar_position: 1
---

Each language is a compiled tree-sitter grammar plus the nvim-treesitter queries, shipped as its own npm package. The core has no language built in, so without a package every document is plain text.

## Packages and ids

| `language` | Package |
| --- | --- |
| `c` | `react-native-codepad-lang-c` |
| `css` | `react-native-codepad-lang-css` |
| `go` | `react-native-codepad-lang-go` |
| `html` | `react-native-codepad-lang-html` |
| `ini` | `react-native-codepad-lang-ini` |
| `java` | `react-native-codepad-lang-java` |
| `javascript` | `react-native-codepad-lang-javascript` |
| `json` | `react-native-codepad-lang-json` |
| `kotlin` | `react-native-codepad-lang-kotlin` |
| `markdown` | `react-native-codepad-lang-markdown` |
| `php`, `php_only` | `react-native-codepad-lang-php` |
| `python` | `react-native-codepad-lang-python` |
| `rust` | `react-native-codepad-lang-rust` |
| `sql` | `react-native-codepad-lang-sql` |
| `swift` | `react-native-codepad-lang-swift` |
| `tsx` | `react-native-codepad-lang-tsx` |
| `typescript` | `react-native-codepad-lang-typescript` |
| `xml`, `dtd` | `react-native-codepad-lang-xml` |
| `yaml` | `react-native-codepad-lang-yaml` |

Pass the id as `language`. The [language packages reference](/reference/languages/) lists each grammar's revision and capture names.

Use `markdown`, not `markdown_inline`: the inline grammar is reached through injection.

Use `php` for web pages and for files that start with `<?php`, and `php_only` for PHP code without the `<?php` tag. The HTML around the PHP code highlights when `react-native-codepad-lang-html` is installed too.

The `sql` grammar parses the usual MySQL statements, with keywords in any case. It doesn't parse `#` comments or `USE` statements. Those lines lose their colors, and the rest of the file keeps them. A backslash escape such as `'It\'s'` ends the string early, and the colors after it can be wrong for the rest of the file. Write `'It''s'` instead, the standard SQL form, which parses. To highlight the MySQL forms, build a patched grammar as a [custom language](/guides/custom-languages/) and rename it in `grammar.js`, for example to `mysql`.

Use `xml` for XML documents such as Android layouts and SVG files, and `dtd` for a standalone DTD file. A DTD inside a `<!DOCTYPE>` highlights with the rest of the XML document.

The `ini` grammar expects a newline after every section header, setting and comment, so end the file with a newline. Only `=` separates a key from its value. The value is read as one piece, including any `; note` written after it on the same line. A comment is a line that starts with `;` or `#`.

`Codepad.availableLanguages()` lists the installed packages:

```ts
import { Codepad } from 'react-native-codepad';

const installed = Codepad.availableLanguages();
// ['javascript', 'markdown', 'markdown_inline', ...]
```

## Plain text fallback

A `language` with no installed package renders as plain text in `foreground` and logs one warning. It doesn't throw. Switching `language` on a live editor reparses the document.

## Injections

A grammar's injection query hands ranges to another language: fenced blocks in Markdown, `<script>` and `<style>` in HTML and XML, the HTML around PHP code and PHP heredocs such as `<<<HTML`, `css` and `html` tagged templates in JavaScript, Markdown front matter. The name comes from the document or from the query, is converted to lowercase, and goes through this table before the registry looks for a package:

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
| `svg`, `xsd`, `xsl`, `xslt`, `rng` | `xml` |
| `dosini`, `confini` | `ini` |

A name with no package keeps the host language's colors. A name from nvim-treesitter's list (`cpp`, `bash`, `sh`, `graphql`, `phpdoc`, `text` and the rest) doesn't log a warning, and highlights only when a [custom language](/guides/custom-languages/) with that id is installed. Any other name logs the fallback warning once.

- Injections go one level deep: a JavaScript block inside Markdown highlights, an HTML template inside that block does not. In a PHP page, the HTML highlights but a `<script>` or `<style>` inside it stays plain.
- In XML, the whole content of a `<script>` or `<style>` element goes to the injected language. Code wrapped in `<![CDATA[ ... ]]>`, as in many SVG files, passes those markers to the JavaScript or CSS parser, and their lines can highlight wrong.
- `${...}` substitutions inside a tagged template are parsed by the injected language.
- Injected trees survive edits and reparse only when their own range changed. The [performance guide](/guides/performance/) has the numbers.

## Size

One native library per ABI, loaded on first use. On `arm64-v8a` in a release build:

| Package | Library |
| --- | --- |
| `sql` | 10.6 MB |
| `kotlin` | 5.5 MB |
| `swift` | 4.0 MB |
| `php` | 2.0 MB, both grammars |
| `tsx`, `typescript` | 1.4 MB each |
| `rust` | 1.1 MB |
| `markdown` | 0.7 MB |
| `c` | 0.6 MB |
| `java`, `javascript`, `python` | 0.4 MB each |
| `go`, `yaml` | 0.2 MB each |
| `css` | 0.1 MB |
| `html`, `ini`, `json`, `xml` | under 0.1 MB, `xml` with both grammars |

An app bundle splits libraries per ABI, so a device downloads one set.

## Adding a language

Packages are generated from `languages/grammars.json` in the repository, never written by hand:

1. Add an entry: the id (it must match the nvim-treesitter query directory), the grammar repository and commit, and the grammar directories. When the grammar is not MIT, add `license` with its SPDX id. The package then declares both licenses.
2. Run `yarn gen:languages <id>`. It fetches the grammar and the queries, translates the predicates and writes the package. Patterns it cannot translate are dropped with a warning each, and `yarn gen:report` lists every predicate per language. Then add each new grammar to `tests/swift/HostGrammars.swift`, and give it a one-line snippet in `LanguagePackagesTest.kt`, `tests/swift/LanguageSmokeTests.swift` and the example app's `LanguagesTest.kt` and `LanguagesTests.swift`.
3. Run `yarn host:treesitter && yarn test:android` to compile the queries against the parser on the JVM.
4. Delete `~/Library/Caches/org.swift.swiftpm/manifests`, then run `yarn test:swift` to compile the queries on macOS. SwiftPM caches the scan that finds the grammar sources, and without this step the new package fails to link.
5. Run `yarn test:device -e class codepad.example.LanguagesTest` to load the package through the real view on an emulator.

CI regenerates every package and fails on any diff. A grammar bump is a `rev` change followed by the same steps.

To highlight a language from your own grammar without adding it here, build a package with the command in the [custom languages guide](/guides/custom-languages/).
