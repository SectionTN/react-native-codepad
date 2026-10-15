---
title: Search
description: setSearch, find, replace and how matches are painted.
sidebar_position: 5
---

Search lives in native: you set a query, the editor paints every match and keeps them current through edits, and the ref walks and replaces them. Results arrive as promises, so a search bar in JavaScript is a few async calls.

## Query

```ts
const { count } = await editor.current.setSearch({
  text: 'readFile',
  regex: false,
  caseSensitive: false,
  wholeWord: false,
});
```

`setSearch` runs the search over a snapshot of the document on the editor's background thread and resolves with the match count once the matches are painted. Options:

- `regex` treats `text` as a regular expression with multiline anchors. Both platforms run ICU's engine, `java.util.regex` on Android (which Android implements over ICU) and `NSRegularExpression` on iOS, so a pattern behaves the same on both: Unicode aware `\w`, `\b` and `\d`, case folding across scripts, lazy and possessive quantifiers, lookahead, lookbehind with a bounded length, and named groups (`(?<name>...)`, Android API 26 and up). An expression that does not compile rejects the promise and clears the search state, so a search bar can show the error and keep typing; the message is the engine's on Android and `invalid regular expression: <text>` on iOS, where the framework reports nothing more.
- `caseSensitive` is off by default; literal search folds case.
- `wholeWord` requires identifier boundaries (`[A-Za-z0-9_]`) on both ends.

Matches never overlap and empty matches are skipped, so `a*` on `aaa` is one match rather than four. The replacement text is always literal: no `$1`.

## Walking the matches

`findNext()` and `findPrevious()` select the next or previous match from the caret with wrap around, reveal it, and resolve with `{ index, total }`, where `index` is 0 based, or `null` when there is no query or no match. The current match is the first one at or after the caret, so a `findNext()` right after `setSearch` lands on the match nearest the caret rather than the first in the file.

```ts
const hit = await editor.current.findNext();
setLabel(hit ? `${hit.index + 1}/${hit.total}` : '0/0');
```

## Replacing

`replaceCurrent(text)` replaces the selection when it equals the current match, selects the next one, and resolves `true`; when the selection is not a match it resolves `false` without touching the document, so call `findNext()` first. `replaceAll(text)` replaces every match in one undo group and resolves with the count.

`clearSearch()` drops the query and the highlights. Search works under `readOnly`, replace included: `readOnly` gates user input, not API writers.

## Painting

Every match is filled with the theme's `searchMatch` and the selected one with `searchMatchActive`, under the text. After an edit the view keeps painting the previous matches mapped through the change (shifted past it, dropped when the edit touched them) until fresh matches arrive for the new revision, which is the next frame in practice. Edits invalidate the results and the next call recomputes them.

## A search bar

The example app's search bar is one effect per query change and three buttons. The `live` flag drops a stale resolution when the query changed while a search was running.

```tsx
useEffect(() => {
  let live = true;
  (async () => {
    if (!text) {
      await editor.current?.clearSearch();
      if (live) setMatch({ index: 0, count: 0 });
      return;
    }
    try {
      const result = await editor.current?.setSearch({ text, regex, caseSensitive, wholeWord });
      if (!live || !result?.count) return;
      const hit = await editor.current?.findNext();
      if (live && hit) setMatch({ index: hit.index + 1, count: hit.total });
    } catch (e) {
      if (live) setError(e instanceof Error ? e.message : String(e));
    }
  })();
  return () => {
    live = false;
  };
}, [text, regex, caseSensitive, wholeWord]);
```

The full component is in the repository under `example/src/components/SearchBar.tsx`. On a 100k line file a literal query with a quarter million matches resolves in under 200 ms; the [performance](/guides/performance/) page has the numbers.
