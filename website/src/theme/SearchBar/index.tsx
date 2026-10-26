import { useHistory } from '@docusaurus/router';
import { usePluginData } from '@docusaurus/useGlobalData';
import clsx from 'clsx';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SiteIndex } from '../../plugins/siteIndex';
import styles from './styles.module.css';

type Result = { kind: 'page' | 'prop' | 'text'; title: string; sub: string; to: string };

const GLYPH = { page: '#', prop: '{}', text: '¶' } as const;

function resultsFor(index: SiteIndex, query: string): { hits: Result[]; text?: Result } {
  const q = query.trim().toLowerCase();
  const pages: Result[] = index.pages.map((p) => ({
    kind: 'page',
    title: p.title,
    sub: p.category,
    to: p.path,
  }));
  const props: Result[] = index.props.map((p) => ({
    kind: 'prop',
    title: p.name,
    sub: `Props · ${p.section} · ${p.type}`,
    to: `${index.propsPath}#prop-${p.name}`,
  }));
  if (!q) {
    return {
      hits: [
        ...pages.filter((p) => p.sub === 'Getting started' || p.title === 'Props'),
        ...props.slice(0, 3),
      ],
    };
  }
  const hits = [...props, ...pages]
    .filter((r) => r.title.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q))
    .slice(0, 9);
  // The theme's full text page answers what titles and prop names do not.
  const text: Result = {
    kind: 'text',
    title: `Search every page for "${query.trim()}"`,
    sub: 'Full text, headings and body',
    to: `/search/?q=${encodeURIComponent(query.trim())}`,
  };
  return { hits, text };
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Palette({ onClose }: { onClose: () => void }) {
  const index = usePluginData('codepad-site-index') as SiteIndex;
  const history = useHistory();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const { hits, text } = useMemo(() => resultsFor(index, query), [index, query]);
  const rows = text ? [...hits, text] : hits;
  const active = Math.min(sel, Math.max(0, rows.length - 1));

  useEffect(() => {
    input.current?.focus();
    if (!reducedMotion()) {
      panel.current?.animate(
        [
          { opacity: 0, transform: 'translateY(-8px) scale(.98)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
    }
  }, []);

  useEffect(() => {
    list.current?.querySelector(`[data-row="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (r: Result) => {
    onClose();
    history.push(r.to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel(Math.min(active + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel(Math.max(active - 1, 0));
    } else if (e.key === 'Enter' && rows[active]) {
      e.preventDefault();
      pick(rows[active]);
    }
  };

  const row = (r: Result, i: number) => (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox input drives the options with arrows and Enter
    <div
      key={r.to}
      id={`cp-search-${i}`}
      role="option"
      tabIndex={-1}
      aria-selected={i === active}
      data-row={i}
      className={clsx(styles.row, i === active && styles.rowActive)}
      onClick={() => pick(r)}
      onMouseEnter={() => i !== active && setSel(i)}
    >
      <span className={clsx(styles.icon, r.kind === 'prop' && styles.iconProp)}>
        {GLYPH[r.kind]}
      </span>
      <span className={styles.text}>
        <span className={clsx(styles.title, r.kind === 'prop' && styles.titleProp)}>{r.title}</span>
        <span className={styles.sub}>{r.sub}</span>
      </span>
      <span className={styles.kind}>{r.kind}</span>
    </div>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a click on the scrim closes; Escape is bound on window
    <div className={styles.overlay} onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops the scrim's click, nothing to do from a key */}
      <div
        ref={panel}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Search the docs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className={styles.lens} aria-hidden="true" />
          <input
            ref={input}
            className={styles.input}
            value={query}
            placeholder="Search pages and props"
            aria-label="Search pages and props"
            role="combobox"
            aria-expanded="true"
            aria-controls="cp-search-list"
            aria-activedescendant={rows.length ? `cp-search-${active}` : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className={styles.esc}>esc</kbd>
        </div>
        <div ref={list} id="cp-search-list" role="listbox" className={styles.list}>
          {hits.map(row)}
          {hits.length === 0 && (
            <div className={styles.empty}>Nothing matches that. Try a prop name like softWrap.</div>
          )}
          {text && row(text, hits.length)}
        </div>
        <div className={styles.foot}>
          <span>↑ ↓ move</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

// The navbar's search pill and the ⌘K palette over pages and props.
export default function SearchBar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <span className={styles.glass} aria-hidden="true" />
        <span>Search docs</span>
        <kbd className={styles.kbd}>⌘K</kbd>
      </button>
      {open && createPortal(<Palette onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
