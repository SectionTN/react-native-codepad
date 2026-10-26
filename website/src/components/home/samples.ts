export const LANGUAGES = [
  'c',
  'css',
  'go',
  'html',
  'java',
  'javascript',
  'json',
  'kotlin',
  'markdown',
  'python',
  'rust',
  'swift',
  'tsx',
  'typescript',
  'yaml',
] as const;
export type Language = (typeof LANGUAGES)[number];

// One file per language package: its name and its source.
export const SAMPLES: Record<Language, [string, string]> = {
  c: [
    'main.c',
    '#include <stdio.h>\n\n// Count the lines on stdin.\nint main(void) {\n    int c, lines = 0;\n    while ((c = getchar()) != EOF)\n        if (c == \'\\n\') lines++;\n    printf("%d lines\\n", lines);\n    return 0;\n}',
  ],
  css: [
    'editor.css',
    '/* The editor fills its pane. */\n.editor {\n  display: flex;\n  font-family: "JetBrains Mono", monospace;\n  line-height: 1.4;\n  color: #e6edf3;\n}\n\n.editor:focus-within {\n  outline: 2px solid #f0883e;\n}',
  ],
  go: [
    'lines.go',
    'package main\n\nimport "fmt"\n\n// Lines counts the newlines in s.\nfunc Lines(s string) int {\n    n := 0\n    for _, r := range s {\n        if r == \'\\n\' {\n            n++\n        }\n    }\n    return n + 1\n}',
  ],
  html: [
    'index.html',
    '<!doctype html>\n<html lang="en">\n  <head>\n    <title>CodePad</title>\n    <style>body { margin: 0; }</style>\n  </head>\n  <body>\n    <main id="app" class="editor"></main>\n    <script>const answer = 42;</script>\n  </body>\n</html>',
  ],
  java: [
    'Lines.java',
    'package dev.codepad;\n\nimport java.util.List;\n\npublic final class Lines {\n    // Counts the non-empty lines.\n    public static int count(List<String> lines) {\n        int n = 0;\n        for (String line : lines) {\n            if (!line.isBlank()) n++;\n        }\n        return n;\n    }\n}',
  ],
  javascript: [
    'sample.js',
    '// readFile with retries\nimport { readFile } from "node:fs/promises";\n\nconst MAX_RETRIES = 3;\n\nexport async function load(path, retries = MAX_RETRIES) {\n  for (let i = 0; i < retries; i++) {\n    try {\n      return await readFile(path, "utf8");\n    } catch (error) {\n      if (i === retries - 1) throw error;\n    }\n  }\n  return null;\n}',
  ],
  json: [
    'theme.json',
    '{\n  "background": "#0d1117",\n  "foreground": "#e6edf3",\n  "tokens": {\n    "keyword": "#ff7b72",\n    "string": "#a5d6ff",\n    "function": "#d2a8ff",\n    "comment": { "color": "#8b949e", "italic": true }\n  },\n  "tabSize": 2,\n  "lineNumbers": true\n}',
  ],
  kotlin: [
    'Lines.kt',
    'package dev.codepad.sample\n\n// A line and its number, one based.\ndata class Line(val number: Int, val text: String)\n\nfun lines(source: String): List<Line> =\n    source.lines().mapIndexed { i, text ->\n        Line(number = i + 1, text = text)\n    }\n\nval blank = lines("a\\n\\nb").count { it.text.isEmpty() }',
  ],
  markdown: [
    'README.md',
    '# CodePad\n\nA **native** code editor for React Native.\n\n## Install\n\n- One package for the editor\n- One `react-native-codepad-lang-*` per language\n\n> No WebView, no `TextInput`.\n\n```tsx\n<CodeEditor language="tsx" />\n```\n\n[Read the docs](https://reactnativecodepad.pages.dev)',
  ],
  python: [
    'count.py',
    'from pathlib import Path\n\n# Count the lines of every Python file.\ndef count_lines(root: str) -> dict[str, int]:\n    totals = {}\n    for path in Path(root).rglob("*.py"):\n        text = path.read_text(encoding="utf8")\n        totals[path.name] = len(text.splitlines())\n    return totals\n\nprint(count_lines("."))',
  ],
  rust: [
    'main.rs',
    'use std::fs;\n\n/// Counts the lines of a file.\nfn count_lines(path: &str) -> std::io::Result<usize> {\n    let text = fs::read_to_string(path)?;\n    Ok(text.lines().count())\n}\n\nfn main() {\n    match count_lines("src/main.rs") {\n        Ok(n) => println!("{n} lines"),\n        Err(e) => eprintln!("error: {e}"),\n    }\n}',
  ],
  swift: [
    'Lines.swift',
    'import Foundation\n\n// A line and its index in the document.\nstruct Line: Identifiable {\n    let id: Int\n    let text: Substring\n}\n\nfunc lines(of source: String) -> [Line] {\n    source.split(separator: "\\n", omittingEmptySubsequences: false)\n        .enumerated()\n        .map { Line(id: $0.offset, text: $0.element) }\n}',
  ],
  tsx: [
    'Screen.tsx',
    "import { CodeEditor, githubDark } from 'react-native-codepad';\n\nexport function Screen() {\n  return (\n    <CodeEditor\n      language=\"tsx\"\n      theme={githubDark}\n      initialValue={'const answer = 42;\\n'}\n      style={{ flex: 1 }}\n    />\n  );\n}",
  ],
  typescript: [
    'position.ts',
    "type Position = { line: number; column: number };\n\n// Offsets count UTF-16 code units.\nexport function toPosition(text: string, offset: number): Position {\n  const before = text.slice(0, offset);\n  const line = before.split('\\n').length - 1;\n  const column = offset - (before.lastIndexOf('\\n') + 1);\n  return { line, column };\n}",
  ],
  yaml: [
    'ci.yml',
    '# .github/workflows/ci.yml\nname: CI\non:\n  push:\n    branches: [main]\njobs:\n  test:\n    runs-on: macos-15\n    steps:\n      - uses: actions/checkout@v4\n      - run: yarn install --immutable\n      - run: yarn test',
  ],
};
