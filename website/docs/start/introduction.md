---
title: Introduction
description: What CodePad is, what it is built on and what it ships with.
sidebar_position: 1
---

React Native CodePad is a code editor for React Native with its own engine. One C++ core runs on both platforms, and a native view draws the text, in Kotlin on Android and in Swift on iOS. Syntax highlighting uses tree-sitter, and each language comes as its own npm package. The view connects to React Native through Nitro, and large files open, scroll and take typing without lag. The [performance guide](/guides/performance/) has the numbers.

CodePad doesn't use a WebView or a `TextInput`. It draws its own caret, selection handles and edit menu.

## Features

- Editing works like a native text field: tap, double tap or touch and hold to select, drag the selection handles under the magnifier, and use the edit menu. Undo and redo, automatic indentation, closing brackets, Tab and Shift+Tab, bracket matching, a highlighted current line, a read-only mode and a placeholder are built in.
- Soft keyboards work, including those that compose Chinese or Japanese characters, and so does the full [hardware key table](/guides/hardware-keyboard/). A [toolbar API](/reference/methods/#toolbar-input) runs the same actions from JavaScript.
- The view has line numbers, wrapped lines or sideways scrolling, and scrolling to a line. It reports the caret position and the visible lines for your own toolbars, takes padding inside the scroll area, and [keeps the caret above the keyboard](/guides/keyboard/).
- [Search](/guides/search/) takes plain text or regular expressions, with case and whole-word options. It moves to the next or previous match, replaces one match or all of them, and paints every match.
- Highlighting comes from nineteen [language packages](/reference/languages/), or from your own grammar as a [custom language](/guides/custom-languages/). Code embedded in other code, such as Markdown code blocks, `<script>` and `<style>` tags and tagged templates, highlights too. The package comes with the [themes](/guides/themes/) `githubLight`, `githubDark` and `oneDark`.
- [Decorations](/guides/decorations/) add underlines, gaps under lines for your own views, and line backgrounds, and they stay on their text as it changes.
