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

  // replaceCurrent selects the next match, which takes over the replaced index unless it was the last one.
  const replaceOne = useCallback(async () => {
    const replaced = await editor.current?.replaceCurrent(replacement);
    if (replaced) {
      const left = Math.max(0, match.count - 1);
      setMatch({ index: left === 0 ? 0 : match.index > left ? 1 : match.index, count: left });
    }
    status.current(replaced ? 'replaced one' : 'select a match first');
  }, [editor, replacement, match]);

  const replaceAll = useCallback(async () => {
    const n = (await editor.current?.replaceAll(replacement)) ?? 0;
    setMatch(NO_MATCH);
    status.current(`replaced ${n}`);
  }, [editor, replacement]);

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
