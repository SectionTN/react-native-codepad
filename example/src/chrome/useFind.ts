import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodeEditorRef } from 'react-native-codepad';

export type FindOption = 'regex' | 'caseSensitive' | 'wholeWord';
export type FindMatch = { index: number; count: number };

const NO_MATCH: FindMatch = { index: 0, count: 0 };

// index is the 1 based position of the selected match, 0 when none is selected.
export function useFind(editor: RefObject<CodeEditorRef | null>, onStatus: (text: string) => void) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [options, setOptions] = useState({ regex: false, caseSensitive: false, wholeWord: false });
  const [match, setMatch] = useState(NO_MATCH);
  // Callers may pass a fresh callback each render; the ref keeps the search effect from re-running for it.
  const status = useRef(onStatus);
  status.current = onStatus;

  // Every query or option change runs a search; the promise settles once the worker has fresh matches.
  useEffect(() => {
    let live = true;
    const run = async () => {
      if (!query) {
        await editor.current?.clearSearch();
        if (live) setMatch(NO_MATCH);
        return;
      }
      try {
        const result = await editor.current?.setSearch({ text: query, ...options });
        if (!live) return;
        const count = result?.count ?? 0;
        if (count === 0) {
          setMatch(NO_MATCH);
          return;
        }
        const hit = await editor.current?.findNext();
        if (!live) return;
        setMatch(hit ? { index: hit.index + 1, count: hit.total } : { index: 0, count });
      } catch {
        if (!live) return;
        setMatch(NO_MATCH);
        status.current('invalid regex');
      }
    };
    void run();
    return () => {
      live = false;
    };
  }, [editor, query, options]);

  // Leaving the bar clears the painted matches.
  useEffect(() => {
    return () => void editor.current?.clearSearch();
  }, [editor]);

  const move = useCallback(
    async (forward: boolean) => {
      const hit = await (forward ? editor.current?.findNext() : editor.current?.findPrevious());
      setMatch(hit ? { index: hit.index + 1, count: hit.total } : NO_MATCH);
    },
    [editor],
  );

  // replaceCurrent selects the next match. Finding again from its start reads its index and the
  // fresh total, which a replacement that still matches keeps.
  const replaceOne = useCallback(async () => {
    const ed = editor.current;
    const replaced = await ed?.replaceCurrent(replacement);
    if (ed && replaced) {
      const { anchor, head } = ed.getSelection();
      const start = Math.min(anchor, head);
      await ed.setSelection({ anchor: start, head: start });
      const hit = await ed.findNext();
      setMatch(hit ? { index: hit.index + 1, count: hit.total } : NO_MATCH);
    }
    status.current(replaced ? 'replaced one' : 'select a match first');
  }, [editor, replacement]);

  // The search stays on after a replace all, so the count is read again for the new text.
  const replaceAll = useCallback(async () => {
    const ed = editor.current;
    const n = (await ed?.replaceAll(replacement)) ?? 0;
    const fresh = query ? await ed?.setSearch({ text: query, ...options }).catch(() => null) : null;
    setMatch(fresh?.count ? { index: 0, count: fresh.count } : NO_MATCH);
    status.current(`replaced ${n}`);
  }, [editor, replacement, query, options]);

  const toggle = useCallback(
    (option: FindOption) => setOptions((o) => ({ ...o, [option]: !o[option] })),
    [],
  );

  return {
    match,
    options,
    setQuery,
    setReplacement,
    toggle,
    next: () => move(true),
    previous: () => move(false),
    replaceOne,
    replaceAll,
  };
}
