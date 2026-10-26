import { useLocation } from '@docusaurus/router';
import { usePluginData } from '@docusaurus/useGlobalData';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { IndexProp, SiteIndex } from '../../plugins/siteIndex';
import styles from './propFilter.module.css';

type PropFilter = { query: string; setQuery: (query: string) => void; props: IndexProp[] };

const Context = createContext<PropFilter | null>(null);
const NONE: IndexProp[] = [];

export const usePropFilter = () => useContext(Context);

type PropText = { name: string; type: string; text: string };

export function matchesProp(query: string, prop: PropText) {
  const q = query.trim().toLowerCase();
  return !q || [prop.name, prop.type, prop.text].some((s) => s.toLowerCase().includes(q));
}

export function sectionCount(filter: PropFilter, sectionId: string) {
  const rows = filter.props.filter((p) => p.sectionId === sectionId);
  return { total: rows.length, shown: rows.filter((p) => matchesProp(filter.query, p)).length };
}

// Holds the props filter of the props page; a #prop-* hash clears it and scrolls to the row.
export function PropFilterProvider({
  docPath,
  children,
}: {
  docPath: string;
  children: ReactNode;
}) {
  const index = usePluginData('codepad-site-index') as SiteIndex;
  const [query, setQuery] = useState('');
  const { hash, key } = useLocation();
  const props = docPath === index.propsPath ? index.props : NONE;
  const value = useMemo(() => ({ query, setQuery, props }), [query, props]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a repeated pick of the same prop has a new location key
  useEffect(() => {
    if (!props.length || !hash.startsWith('#prop-')) return;
    setQuery('');
    const timer = setTimeout(() => {
      document
        .getElementById(decodeURIComponent(hash.slice(1)))
        ?.scrollIntoView({ block: 'start' });
    }, 60);
    return () => clearTimeout(timer);
  }, [hash, key, props]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

// <CodeEditor [filter] N of 23 />, sticky above the prop sections.
export function PropFilterBar({ filter }: { filter: PropFilter }) {
  const total = filter.props.length;
  const shown = filter.props.filter((p) => matchesProp(filter.query, p)).length;
  return (
    <>
      <div className={styles.bar} data-in>
        <span className={styles.tag}>&lt;CodeEditor</span>
        <input
          className={styles.input}
          value={filter.query}
          onChange={(e) => filter.setQuery(e.target.value)}
          placeholder={`filter ${total} props`}
          aria-label="Filter the props by name, type or note"
        />
        <span className={styles.count}>
          {filter.query.trim() ? `${shown} of ${total}` : `${total} props`}
        </span>
        <span className={styles.tagEnd}>/&gt;</span>
      </div>
      {shown === 0 && (
        <div className={styles.empty}>
          No prop matches <span className={styles.emptyQuery}>{filter.query}</span>. The callbacks
          are on the events page.
        </div>
      )}
    </>
  );
}
