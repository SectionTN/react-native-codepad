---
title: Search
description: setSearch, find, replace and how matches are painted.
sidebar_position: 5
---

Search lives in native: set a query, the editor paints every match and keeps them current through edits, and the ref walks and replaces them. A search bar in JavaScript is a few async calls.

## Query

```ts
const { count } = await editor.current.setSearch({
  text: 'readFile',
  regex: false,
  caseSensitive: false,
  wholeWord: false,
});
```

`setSearch` resolves with the match count once the matches are painted.

- `regex`: ICU on both platforms (`java.util.regex` on Android, `NSRegularExpression` on iOS), so Unicode `\w` and `\b`, lookahead, bounded lookbehind and named groups behave the same. A pattern that does not compile rejects the promise and clears the search, so the bar can show the error and keep typing.
- `caseSensitive`: off by default.
- `wholeWord`: identifier boundaries (`[A-Za-z0-9_]`) on both ends.

Matches never overlap and empty matches are skipped: `a*` on `aaa` is one match. The replacement text is literal, no `$1`.

## Walking the matches

`findNext()` and `findPrevious()` select the next or previous match from the caret with wrap around, reveal it, and resolve with `{ index, total }` (`index` 0 based), or `null` without a query or matches. Right after `setSearch`, `findNext()` lands on the match nearest the caret.

```ts
const hit = await editor.current.findNext();
setLabel(hit ? `${hit.index + 1}/${hit.total}` : '0/0');
```

## Replacing

`replaceCurrent(text)` replaces the selected match, selects the next one and resolves `true`; when the selection is not a match it resolves `false` and touches nothing, so call `findNext()` first. `replaceAll(text)` replaces every match in one undo group and resolves with the count.

`clearSearch()` drops the query and the highlights. Search and replace work under `readOnly`, which gates user input only.

## Painting

Matches are filled with the theme's `searchMatch`, the selected one with `searchMatchActive`. After an edit the previous matches stay painted, shifted through the change, until the fresh ones arrive on the next frame.

## A search bar

The example app's search bar is one effect per query change and three buttons. The `live` flag drops a stale resolution when the query changed while a search ran.

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

The full component is in the repository under `example/src/components/SearchBar.tsx`. A literal query with a quarter million matches on a 100k line file resolves in under 200 ms; [performance](/guides/performance/) has the numbers.
