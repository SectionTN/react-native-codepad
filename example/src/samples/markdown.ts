export const markdown = `---
title: Release notes
tags: [editor, android]
draft: false
---

# Codepad 0.1

A native code editor for React Native, with **tree-sitter** highlighting and *no WebView*.

## What landed

- Fifteen language packages, one per npm package
- Injections: fenced blocks, \`<script>\` and \`<style>\`, front matter
- Themes that cover every capture the queries produce

Read the [documentation](https://reactnativecodepad.pages.dev/) for the API.

\`\`\`js
const editor = useRef(null);
editor.current?.setText("hello");
\`\`\`

\`\`\`python
def greet(name: str) -> str:
    return f"hello {name}"
\`\`\`
`;
