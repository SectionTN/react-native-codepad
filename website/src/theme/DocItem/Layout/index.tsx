import Link from '@docusaurus/Link';
import { useDoc, useDocsSidebar } from '@docusaurus/plugin-content-docs/client';
import ContentVisibility from '@theme/ContentVisibility';
import DocItemContent from '@theme/DocItem/Content';
import type { Props } from '@theme/DocItem/Layout';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import {
  PropFilterProvider,
  sectionCount,
  usePropFilter,
} from '../../../components/docs/propFilter';
import { groupsOf, samePath } from '../../../components/docs/sidebarGroups';
import { REPO } from '../../../data/site';
import styles from './styles.module.css';

const ACTIVE_LINE = 170;
const ROW = 30;

// Below 900 px the sidebar folds into this button and an inline grid of every page.
function Menu({ permalink, title }: { permalink: string; title: string }) {
  const sidebar = useDocsSidebar();
  const [open, setOpen] = useState(false);
  if (!sidebar) return null;
  const groups = groupsOf(sidebar.items);
  const group = groups.find((g) => g.links.some((link) => samePath(link.href, permalink)));
  return (
    <div className={styles.menu}>
      <button
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.burger}>
          <span />
          <span />
          <span />
        </span>
        <span>Menu</span>
        <span className={styles.menuWhere}>
          {group ? `${group.label} / ` : ''}
          {title}
        </span>
      </button>
      {open && (
        <div className={styles.drawer}>
          {groups.map((g) => (
            <div key={g.label}>
              <div className={styles.drawerLabel}>{g.label}</div>
              {g.links.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={styles.drawerLink}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// On this page, with an accent bar that slides to the section under the line at 170 px.
function Toc() {
  const { toc } = useDoc();
  const filter = usePropFilter();
  const items = useMemo(
    () =>
      toc.filter(
        (item) =>
          item.level <= 3 &&
          !(
            filter?.props.some((p) => p.sectionId === item.id) &&
            sectionCount(filter, item.id).shown === 0
          ),
      ),
    [toc, filter],
  );
  const [active, setActive] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      let index = 0;
      items.forEach((item, i) => {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top < ACTIVE_LINE) index = i;
      });
      setActive(index);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);
  if (!items.length) return null;
  const toTop = () => window.scrollTo(0, 0);
  return (
    <div className={clsx(styles.toc, 'cp-touch')}>
      <div className={styles.tocLabel}>On this page</div>
      <div className={styles.tocList}>
        <span className={styles.tocRail} />
        <span
          className={styles.tocBar}
          style={{ top: Math.min(active, items.length - 1) * ROW + 6 }}
        />
        {items.map((item, i) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={clsx(
              styles.tocLink,
              item.level === 3 && styles.tocNested,
              i === active && styles.tocActive,
            )}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: toc values are the theme's own heading HTML
            dangerouslySetInnerHTML={{ __html: item.value }}
          />
        ))}
      </div>
      <div className={styles.tocMore}>
        <button type="button" className={styles.tocMoreLink} onClick={toTop}>
          Back to top ↑
        </button>
        <a href={`${REPO}/issues`} className={styles.tocMoreLink}>
          Ask a question
        </a>
      </div>
    </div>
  );
}

function Pager() {
  const { metadata } = useDoc();
  const { previous, next } = metadata;
  if (!previous && !next) return null;
  return (
    <nav className={clsx(styles.pager, 'cp-touch')} aria-label="Docs pages">
      {previous ? (
        <Link to={previous.permalink} className={styles.page}>
          <span className={styles.pageLabel}>← previous</span>
          <span className={styles.pageTitle}>{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={next.permalink} className={clsx(styles.page, styles.pageNext)}>
          <span className={styles.pageLabel}>next →</span>
          <span className={styles.pageTitle}>{next.title}</span>
        </Link>
      )}
    </nav>
  );
}

export default function DocItemLayout({ children }: Props) {
  const { metadata, frontMatter } = useDoc();
  return (
    <PropFilterProvider docPath={metadata.permalink}>
      <main className={styles.main}>
        <article className={styles.article}>
          <ContentVisibility metadata={metadata} />
          <Menu permalink={metadata.permalink} title={metadata.title} />
          <DocItemContent>{children}</DocItemContent>
          <Pager />
        </article>
      </main>
      {!frontMatter.hide_table_of_contents && <Toc />}
    </PropFilterProvider>
  );
}
