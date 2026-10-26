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

// docs / reference / props: each folder links to its first page, the page itself is the accent.
function Crumbs({ permalink }: { permalink: string }) {
  const index = usePluginData('codepad-site-index') as SiteIndex;
  const segments = permalink.split('/').filter(Boolean);
  const first = (segment: string) =>
    index.pages.find((p) => p.path.startsWith(`/${segment}/`))?.path;
  return (
    <div className={styles.crumbs}>
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
        <h1 className={styles.title}>{metadata.title}</h1>
        {frontMatter.description && <p className={styles.description}>{frontMatter.description}</p>}
        <div className={clsx(styles.actions, 'cp-touch')}>
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
