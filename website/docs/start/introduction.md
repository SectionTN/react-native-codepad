---
title: Introduction
description: What CodePad is, what it is built on and what it ships with.
sidebar_position: 1
---

React Native CodePad is a code editor for React Native with its own engine on each platform: Kotlin on Android, Swift on iOS. Highlighting is done with the help of tree-sitter, and each language comes as its own npm package. The view is bound through Nitro, so everything works in a blink of an eye.

No WebView, no `TextInput`. CodePad draws its own caret, selection handles and edit menu, natively.

## Features

- Editing: tap, double tap and long press selection with handles, the loupe and the edit menu, undo and redo, auto indent, auto closing pairs, Tab and Shift+Tab, bracket matching, an active line, a read only mode and a placeholder.
- Keyboards: soft keyboards with composition, the full [hardware key table](/guides/hardware-keyboard/), and a [toolbar API](/reference/methods/#toolbar-input) that drives the same paths from JavaScript.
- View: a line number gutter, soft wrap or horizontal scroll, scroll to line, the caret rect and the visible lines for toolbars, content insets, and an editor that [follows the keyboard](/guides/keyboard/).
- Search: literal or regex, case sensitive and whole word options, next and previous, replace one or all, with every match painted.
- Highlighting: fifteen [language packages](/reference/languages/), injections for fenced blocks, embedded script and style tags and tagged templates, and three themes.
