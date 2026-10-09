# react-native-codepad-lang-markdown

Generated package. Do not edit by hand; run `yarn gen:languages` in the react-native-codepad repository.

Grammar: tree-sitter-grammars/tree-sitter-markdown at a0a00f817d02412bd92c54d316f164d827b57b5c. Queries: nvim-treesitter at e289100ff98969e118c702199d88b764ce9e7fdf.

## Install

```sh
yarn add react-native-codepad react-native-codepad-lang-markdown
```

Then pass `language="markdown"` to `CodeEditor`. Theme token keys this package produces:

### markdown

- `keyword.directive`
- `label`
- `markup.heading`
- `markup.heading.1`
- `markup.heading.2`
- `markup.heading.3`
- `markup.heading.4`
- `markup.heading.5`
- `markup.heading.6`
- `markup.link.label`
- `markup.link.url`
- `markup.list`
- `markup.list.checked`
- `markup.list.unchecked`
- `markup.quote`
- `markup.raw.block`
- `punctuation.delimiter`
- `punctuation.special`
- `spell`
- `string.escape`

### markdown_inline

- `character.special`
- `conceal`
- `markup.italic`
- `markup.link`
- `markup.link.label`
- `markup.link.url`
- `markup.raw`
- `markup.strikethrough`
- `markup.strong`
- `nospell`

See the [languages guide](https://sectiontn.github.io/react-native-codepad/guides/languages/) for aliases, injections and themes.
