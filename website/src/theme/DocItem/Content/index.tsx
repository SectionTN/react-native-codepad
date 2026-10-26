import Link from '@docusaurus/Link';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import { ThemeClassNames } from '@docusaurus/theme-common';
import { usePluginData } from '@docusaurus/useGlobalData';
import type { Props } from '@theme/DocItem/Content';
import MDXContent from '@theme/MDXContent';
import clsx from 'clsx';
import { Fragment, useState } from 'react';
import { CopyIcon } from '../../../components/home/InstallCommand';
import { RAW_DOCS } from '../../../data/site';
import type { SiteIndex } from '../../../plugins/siteIndex';
import styles from './styles.module.css';

const stagger = (i: number) => ({ animationDelay: `${60 + i * 60}ms` });

// docs / reference / props: each folder links to its first page, the page itself is the accent.
function Crumbs({ permalink }: { permalink: string }) {
  const index = usePluginData('codepad-site-index') as SiteIndex;
  const segments = permalink.split('/').filter(Boolean);
  const first = (segment: string) =>
    index.pages.find((p) => p.path.startsWith(`/${segment}/`))?.path;
  return (
    <div className={clsx(styles.crumbs, styles.in)} style={stagger(0)}>
      <Link to={index.pages[0]?.path ?? '/'} className={styles.crumb}>
        docs
      </Link>
      {segments.map((segment, i) => (
        <Fragment key={segment}>
          <span>/</span>
          {i === segments.length - 1 ? (
            <span className={styles.current}>{segment}</span>
          ) : (
            <Link to={first(segment) ?? permalink} className={styles.crumb}>
              {segment}
            </Link>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function CopyMarkdown({ source }: { source: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const url = RAW_DOCS + source.replace('@site/', '');
    const text = fetch(url).then((r) => r.text());
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    };
    // Safari keeps the user gesture only when the clipboard write starts in the click handler.
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const blob = text.then((t) => new Blob([t], { type: 'text/plain' }));
      navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]).then(done, () => {});
    } else {
      text.then((t) => navigator.clipboard?.writeText(t)).then(done, () => {});
    }
  };
  return (
    <button type="button" className={styles.copy} onClick={copy}>
      <CopyIcon copied={copied} />
      {copied ? 'Copied' : 'Copy as Markdown'}
    </button>
  );
}

// The page header (breadcrumb, title, description, copy and edit) above the Markdown body.
export default function DocItemContent({ children }: Props) {
  const { metadata, frontMatter } = useDoc();
  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, 'markdown')}>
      <header className={styles.header}>
        <Crumbs permalink={metadata.permalink} />
        <h1 className={clsx(styles.title, styles.in)} style={stagger(1)}>
          {metadata.title}
        </h1>
        {frontMatter.description && (
          <p className={clsx(styles.description, styles.in)} style={stagger(2)}>
            {frontMatter.description}
          </p>
        )}
        <div className={clsx(styles.actions, styles.in, 'cp-touch')} style={stagger(3)}>
          <CopyMarkdown source={metadata.source} />
          {metadata.editUrl && (
            <a href={metadata.editUrl} className={styles.edit}>
              Edit this page
            </a>
          )}
        </div>
      </header>
      <MDXContent>{children}</MDXContent>
    </div>
  );
}
