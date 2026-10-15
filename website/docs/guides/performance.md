---
title: Performance
description: How CodePad handles large documents, what to watch out for in its API, and how to run the benchmarks yourself.
sidebar_position: 7
---

CodePad is built to handle large files without making every keystroke or scroll more expensive as the document grows.

This guide covers how the editor handles large documents, what to watch out for when using its API, and how to run the benchmarks yourself.

## Large files

Opening a large file takes time. CodePad has to parse the document, calculate syntax highlighting and lay out the text before it can display everything correctly.

CodePad runs parsing separately from rendering and can display text before syntax highlighting is ready. It also updates syntax incrementally, so editing a line doesn't require parsing the entire document again.

Here are some results from the Android benchmark suite on the `debugOptimized` variant:

- Opening a 10,000-line file took 27-35 ms.
- Opening a 100,000-line file took 143-181 ms.
- Scrolling through a 10,000-line file produced 2 janky frames out of 832.
- Scrolling through a 100,000-line file while its initial parse was running produced 4 janky frames out of 829.
- Typing in a 10,000-line file took 5-11 ms for key handling and drawing.

These measurements were taken on an Android emulator running API 36, using `-gpu host` on an M1 Pro chip for GPU acceleration through MoltenVK. The app used the `debugOptimized` build with Metro attached. Results will vary by device and build configuration.

### Markdown and injected grammars

Markdown is more expensive to parse than it might look. A document can contain inline grammar rules, fenced code blocks and language-specific syntax inside those blocks.

We tested a Markdown document containing 2,000 paragraphs, 5,880 lines and 2,239 grammar injections.

When every edit reparsed all injected grammars, updating syntax after a keystroke took 146-165 ms in the measured runs. With CodePad's incremental parsing, warm updates took around 3-4 ms.

The initial parse still has a cost. The difference shows up when editing: CodePad can reuse unaffected syntax information instead of recalculating everything.

## API usage

### Avoid copying the entire document on every change

`onChangeText` gives you the updated document as a string. For large files, retrieving that string on every edit means repeatedly copying the entire document.

Use `onChange` when you only need to know what changed. It provides the edit delta, so you can react to a modification without reading the whole file.

```tsx
<CodeEditor
  onChange={(change) => {
    // Handle the edit without copying the full document.
  }}
/>
```

Use `getText()` when you actually need the complete document, such as when saving or exporting it.

### Read only the text you need

Calling `getText()` creates a copy of the document. This can become expensive when the file contains hundreds of thousands of lines.

For smaller reads, use `getLine()` or `getTextInRange()` instead.

For example, a feature that needs the current line doesn't need to retrieve the entire document just to extract it.

### Keep object props stable

Passing a newly created object on every React render can cause unnecessary updates to the native editor.

This applies to props such as `theme` and `contentInsets`. Keep their references stable when their values haven't changed.

```tsx
const theme = {
  // Your theme configuration
};

const contentInsets = {
  // Your inset configuration
};
```

For configuration that depends on component state, use `useMemo` where appropriate.

### Be careful with automatic height

An editor with automatic height needs to lay out all its lines. A fixed-height editor can focus its layout work on the visible viewport.

For large documents, prefer a constrained editor. Automatic height is better suited to smaller amounts of text.

Soft wrapping also requires measuring visible lines against the available width. When the width changes, such as after rotating a device, those lines need to be laid out again.

### Avoid expensive work in frequent callbacks

`onScroll` and `onSelectionChange` are coalesced to at most one event per frame.

Keep these callbacks lightweight. Updating React state is fine when needed, but avoid running expensive document operations or unrelated computations on every event.

### Account for language initialization

The first editor opened for a language needs to load its language library and compile its queries. Later editors using the same language in that process can reuse the initialized resources.

Keep this in mind when measuring startup performance. A first run and a subsequent run don't necessarily have the same cost.

## Searching large documents

Search performance depends on the document and the number of matches.

In the 100,000-line benchmark, literal search found 274,316 matches in 165 ms. Regex search found 54,864 matches in 103 ms.

Memory usage is another consideration. Loading the 100,000-line document increased Java heap usage by 14.3 MB for 6.6 MB of text.

These are benchmark results, not fixed limits. Use your own documents when evaluating search and memory performance in your application.

## iOS

The iOS editor uses the same general approach: recycled line layers, cached layout around the viewport, and parsing on a separate queue.

In the iOS simulator, typing in a 10,000-line document took around 3 ms for key handling and layout. Measuring through the end of drawing increased that to around 11 ms in the typical case.

Simulator results are useful for checking regressions, but they don't guarantee the same performance on a physical iPhone. If you have one, numbers from it are welcome in an issue.

## Running the benchmarks

With the example app running on an Android emulator, run from the repository root:

```sh
yarn bench:scroll
yarn bench:memory
yarn bench:typing
```

For iOS:

```sh
yarn bench:ios scroll
yarn bench:ios memory
yarn bench:ios typing
```

When comparing results, keep the device, build configuration and test conditions consistent. Run each test more than once, and distinguish first-run costs from subsequent runs.

A change that improves one benchmark may affect another. Check typing, scrolling, memory and first paint together before deciding whether an optimization is worth keeping.

Also, make sure you test on AC power, for full performance. On battery, macOS throttles the emulator.
