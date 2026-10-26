import Link from '@docusaurus/Link';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { REPO } from '../../data/site';
import styles from './FinalCta.module.css';
import { EASE_UI, PM_ADD, PM_HEAD, PMS, prefersReducedMotion, usePackageManager } from './hooks';
import { PACKAGES, PmTabs } from './InstallCommand';
import ui from './ui.module.css';

export function FinalCta() {
  const [pm, setPm] = usePackageManager();
  const head = useRef<HTMLButtonElement>(null);
  const shown = useRef(pm);

  useEffect(() => {
    if (shown.current === pm) return;
    shown.current = pm;
    if (prefersReducedMotion()) return;
    head.current?.animate(
      [
        { opacity: 0, transform: 'translateY(.25em)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
      ],
      { duration: 420, easing: EASE_UI },
    );
  }, [pm]);

  return (
    <section className={ui.section}>
      <div data-reveal className={styles.card}>
        <div className={styles.rules} />
        <div className={styles.glow} />
        <h2 className={styles.title}>
          <button
            ref={head}
            type="button"
            title="Switch package manager"
            className={styles.pm}
            onClick={() => setPm(PMS[(PMS.indexOf(pm) + 1) % PMS.length])}
          >
            {PM_HEAD[pm]}
          </button>
          <br />
          and start typing.
        </h2>
        <p className={styles.lead}>
          Add the editor and one language package, run pod install, and follow the quick start.
        </p>
        <PmTabs className={styles.tabs} />
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (axe scrollable-region-focusable) */}
        <div className={styles.commands} tabIndex={0}>
          <div>
            <span className={styles.prompt}>$</span> {PM_ADD[pm]} {PACKAGES}{' '}
            react-native-codepad-lang-javascript
          </div>
          <div>
            <span className={styles.prompt}>$</span> cd ios{' '}
            <span className={styles.and}>&amp;&amp;</span> pod install
          </div>
        </div>
        <div className={styles.actions}>
          <Link to="/start/quick-start/" className={clsx(ui.primary, styles.big)}>
            Read the quick start <span>→</span>
          </Link>
          <a href={REPO} className={clsx(ui.secondary, styles.big, styles.ghost)}>
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
