import Link from '@docusaurus/Link';
import { useColorMode, useThemeConfig } from '@docusaurus/theme-common';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import NavbarNavLink from '@theme/NavbarItem/NavbarNavLink';
import SearchBar from '@theme/SearchBar';
import { GitHubIcon, Mark } from '../../../components/Mark';
import { REPO } from '../../../data/site';
import styles from './styles.module.css';

type LinkItem = { to: string; label: string; activeBaseRegex?: string };

// Both glyphs render and CSS picks one from html[data-theme], so the server markup never mismatches.
function ColorModeButton() {
  const { colorMode, setColorMode } = useColorMode();
  return (
    <button
      type="button"
      className={styles.square}
      aria-label="Toggle color mode"
      onClick={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')}
    >
      <span className={styles.moon} />
      <span className={styles.sun} />
    </button>
  );
}

export default function NavbarContent() {
  const items = useThemeConfig().navbar.items as LinkItem[];
  const { siteConfig } = useDocusaurusContext();
  return (
    <div className={styles.inner}>
      <Link to="/" className={styles.brand}>
        <Mark />
        <span className={styles.name}>CodePad</span>
        <span className={styles.version}>{String(siteConfig.customFields?.version)}</span>
      </Link>
      <div className={styles.links}>
        {items.map((item) => (
          <NavbarNavLink
            key={item.label}
            to={item.to}
            label={item.label}
            activeBaseRegex={item.activeBaseRegex}
            className={styles.link}
            activeClassName={styles.active}
          />
        ))}
      </div>
      <div className={styles.actions}>
        <SearchBar />
        <a href={REPO} aria-label="GitHub repository" className={styles.square}>
          <GitHubIcon size={20} />
        </a>
        <ColorModeButton />
      </div>
    </div>
  );
}
