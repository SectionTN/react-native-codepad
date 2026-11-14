---
title: Languages
description: How to install a language, pick it with the language prop, and highlight code embedded in another language.
sidebar_position: 1
---

Each language CodePad ships comes as its own npm package, named `react-native-codepad-lang-<id>`. CodePad has no language built in, so without a package every document is plain text.

## Install a language

Install the package next to the core, rebuild the app, and pass the language id as `language`:

```tsx
<CodeEditor language="python" />
```

The [language packages reference](/reference/languages/) lists all nineteen packages with their ids.

Use `markdown` for Markdown. The package also holds `markdown_inline`, which the editor uses only inside Markdown.

Use `php` for web pages and for files that start with `<?php`, and `php_only` for PHP code without the `<?php` tag. The HTML around the PHP code highlights when `react-native-codepad-lang-html` is installed too.

The `sql` grammar reads the usual MySQL statements, with keywords in any case. It doesn't read `#` comments or `USE` statements, so those lines lose their colors while the rest of the file keeps them. A backslash escape such as `'It\'s'` ends the string early, and the colors after it can be wrong for the rest of the file. Write `'It''s'` instead, the standard SQL form. To highlight the MySQL forms, build a patched grammar as a [custom language](/guides/custom-languages/) and rename it in `grammar.js`, for example to `mysql`.

Use `xml` for XML documents such as Android layouts and SVG files, and `dtd` for a standalone DTD file. A DTD inside a `<!DOCTYPE>` highlights with the rest of the XML document.

The `ini` grammar expects a line break after every section header, setting and comment, so end the file with a line break. Only `=` separates a key from its value. The value is read as one piece, including any `; note` written after it on the same line. A comment is a line that starts with `;` or `#`.

`Codepad.availableLanguages()` lists the installed languages:

```ts
import { Codepad } from 'react-native-codepad';

const installed = Codepad.availableLanguages();
// ['javascript', 'markdown', 'markdown_inline', ...]
```

## Plain text

A `language` without its package shows plain text in the theme's `foreground` color. Changing `language` while the editor is open highlights the document again in the new language.

## Code inside other languages

Some languages hold code written in another language: fenced code blocks in Markdown, `<script>` and `<style>` tags in HTML and XML, the HTML around PHP code, PHP heredocs such as `<<<HTML`, `css` and `html` tagged templates in JavaScript, and Markdown front matter. The editor highlights that code in its own language when that language's package is installed.

The language name comes from the document, such as the word after a Markdown fence, or from the grammar. The editor reads it in lowercase and maps these short names first:

| Name in the document | Language |
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

Code in a language with no installed package keeps the colors of the code around it. A language CodePad doesn't ship, such as `cpp`, `bash` or `graphql`, highlights once you install a [custom language](/guides/custom-languages/) with that id.

- Embedding goes one level deep. A JavaScript block inside Markdown highlights, but an HTML template inside that block doesn't. In a PHP page, the HTML highlights, but a `<script>` or `<style>` inside it stays plain.
- In XML, the whole content of a `<script>` or `<style>` element goes to JavaScript or CSS. Code wrapped in `<![CDATA[ ... ]]>`, as in many SVG files, keeps those markers, and its lines can highlight wrong.
- The embedded language also reads the `${...}` substitutions inside a tagged template.
- Editing one embedded block doesn't make the editor read the other blocks again. The [performance guide](/guides/performance/) has the numbers.

## Size

On Android, each package adds a native library to the app, which loads the first time an editor uses the language. On iOS, the grammar is built into the app. These are the library sizes on Android `arm64-v8a` in a release build:

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
| `html`, `ini`, `json`, `xml` | Under 0.1 MB, `xml` with both grammars |

When you publish an Android App Bundle, each device downloads only the libraries for its own CPU.

## Other languages

To highlight a language CodePad doesn't ship, build a package from its tree-sitter grammar with the command in the [custom languages guide](/guides/custom-languages/). To add a language to CodePad itself, see [Add a language](/internals/contributing/#add-a-language) on the contributing page.
