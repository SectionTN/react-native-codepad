import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';
import { useThemeConfig } from '@docusaurus/theme-common';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { Mark } from '../../components/Mark';
import { REPO } from '../../data/site';
import styles from './styles.module.css';

type FooterItem = { label: string; to?: string; href?: string };
type FooterColumn = { title: string; items: FooterItem[] };

const credit = (
  <>
    Made by <a href="https://github.com/SectionTN">SectionTN</a>
  </>
);

// The landing gets the full footer; docs and the other pages get one line.
export default function Footer() {
  const { pathname } = useLocation();
  const home = useBaseUrl('/');
  const { footer } = useThemeConfig();
  const { siteConfig } = useDocusaurusContext();
  if (pathname !== home) {
    return (
      <footer className={styles.slim}>
        <div className={styles.slimInner}>
          <span>{credit} · MIT</span>
          <span className={styles.slimLinks}>
            <a href={REPO}>GitHub</a>
            <a href={`${REPO}/releases`}>Releases</a>
          </span>
        </div>
      </footer>
    );
  }
  const columns = (footer?.links ?? []) as FooterColumn[];
  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <div className={styles.about}>
          <div className={styles.brand}>
            <Mark size={30} />
            <span>React Native CodePad</span>
          </div>
          <p>
            A native code editor for React Native. MIT licensed, with each grammar's license in its
            package.
          </p>
        </div>
        <div className={styles.columns}>
          {columns.map((col) => (
            <div key={col.title} className={styles.column}>
              <div className={styles.title}>{col.title}</div>
              {col.items.map((item) => (
                <Link
                  key={item.label}
                  className={styles.link}
                  {...(item.href ? { href: item.href } : { to: item.to })}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.bottom}>
        <span>{credit}</span>
        <span className={styles.version}>v{String(siteConfig.customFields?.version)}</span>
      </div>
    </footer>
  );
}
