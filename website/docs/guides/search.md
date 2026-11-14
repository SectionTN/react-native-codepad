---
title: Search
description: How to set a query, move through the matches and replace them, and how matches are painted.
sidebar_position: 5
---

The editor searches the document natively. You set a query, and the editor paints every match and keeps the matches up to date as the text changes. You move through them and replace them with the ref, so a search bar in JavaScript takes a few async calls.

## Query

```ts
const { count, limited } = await editor.current.setSearch({
  text: 'readFile',
  regex: false,
  caseSensitive: false,
  wholeWord: false,
});
```

`setSearch` resolves with the match count once the matches are painted.

- `regex` turns the query into a regular expression. Regular expressions work the same on both platforms, with lookahead, lookbehind of a limited length and named groups. `\w` and `\b` work with letters from every language. A pattern that doesn't compile rejects the promise and clears the search, so your bar can show the error while the user keeps typing.
- A very complex pattern, such as `(a+)+$` over a long run of `a`, can stop early. The promise then resolves with `limited: true`, and `count` covers only the matches found so far. Your bar can show the count as incomplete.
- `caseSensitive` is off by default.
- `wholeWord` keeps only the matches with no ASCII letter, digit or `_` right before or after them.

Matches never overlap, and the editor skips empty matches, so `a*` on `aaa` is one match. The replacement text is used as is, so `$1` stays `$1`.

## Next and previous match

`findNext()` and `findPrevious()` select the next or previous match from the caret, wrapping around, and scroll to it. They resolve with `{ index, total }`, where `index` counts from 0, or with `null` when there is no query or no match. Right after `setSearch`, `findNext()` selects the first match at or after the caret.

```ts
const hit = await editor.current.findNext();
setLabel(hit ? `${hit.index + 1}/${hit.total}` : '0/0');
```

## Replace

`replaceCurrent(text)` replaces the selected match, selects the next one and resolves with `true`. When the selection isn't a match, it resolves with `false` and leaves the document as it is, so call `findNext()` first. `replaceAll(text)` replaces every match in one undo step and resolves with the number of replacements.

`clearSearch()` clears the query and the highlights. Search, `replaceCurrent()` and `replaceAll()` also work when `readOnly` is on.

## Match colors

The editor fills each match with the theme's `searchMatch` color and the selected match with `searchMatchActive`. After an edit, the old matches stay painted and move with the text until the new ones arrive on the next frame.

## A find bar

The example app's find bar runs one effect per query change. The `live` flag drops a result that arrives after the query changed again:

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

The example keeps this logic in `example/src/chrome/useFind.ts` in the repository. On an Android emulator, a literal search with a quarter million matches in a 100,000-line file resolves in under 200 ms. The [performance guide](/guides/performance/) has more numbers.
