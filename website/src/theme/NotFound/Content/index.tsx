import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';
import type { Props } from '@theme/NotFound/Content';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { EASE_UI, prefersReducedMotion } from '../../../components/home/hooks';
import ui from '../../../components/home/ui.module.css';
import { OPEN_SEARCH } from '../../../data/site';
import styles from './styles.module.css';

// The missing address types itself into a small editor, then a hand-drawn diagnostic appears under it.
export default function NotFoundContent({ className }: Props) {
  const { pathname } = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setTyped(pathname.length);
      setDone(true);
      return;
    }
    const entrance = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-in]') ?? []).map(
      (el, i) =>
        el.animate(
          [
            { opacity: 0, transform: 'translateY(16px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 800, delay: 80 + i * 90, easing: EASE_UI, fill: 'backwards' },
        ),
    );
    let n = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (n < pathname.length) {
        n++;
        setTyped(n);
        timer = setTimeout(step, 55 + Math.random() * 60);
      } else {
        timer = setTimeout(() => setDone(true), 380);
      }
    };
    timer = setTimeout(step, 900);
    return () => {
      clearTimeout(timer);
      for (const a of entrance) a.cancel();
    };
  }, [pathname]);

  return (
    <main className={clsx('cp-redesign', styles.main, className)}>
      <div className={styles.rules} />
      <div className={styles.glow} />
      <div ref={root} className={styles.inner}>
        <div data-in className={ui.eyebrow} style={{ marginBottom: 0 }}>
          <span className={ui.slashes}>{'//'}</span>
          <span className={ui.number}>404</span>
        </div>
        <h1 data-in className={styles.title}>
          Page not found.
        </h1>
        <p data-in className={styles.lead}>
          There is no page at this address. Start from the installation or search the site.
        </p>
        <div data-in className={styles.card}>
          <div className={styles.head}>
            <span>router.ts</span>
            <span className={styles.problem}>1 problem</span>
          </div>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (axe scrollable-region-focusable) */}
          <div className={styles.code} tabIndex={0}>
            <div className={styles.line}>
              <span className={styles.gutter}>1</span>
              <span>
                <span className={styles.k}>import</span> {'{ site }'}{' '}
                <span className={styles.k}>from</span>{' '}
                <span className={styles.s}>'react-native-codepad/docs'</span>
                {';'}
              </span>
            </div>
            <div className={styles.line}>
              <span className={styles.gutter}>2</span>
              <span />
            </div>
            <div className={clsx(styles.line, styles.active)}>
              <span className={styles.gutter}>3</span>
              <span>
                <span className={styles.k}>await</span> site.<span className={styles.f}>open</span>(
                <span className={styles.s}>"</span>
                <span className={clsx(styles.s, done && styles.squiggle)}>
                  {pathname.slice(0, typed)}
                </span>
                {!done && <span className={styles.caret} />}
                <span className={styles.s}>"</span>);
              </span>
            </div>
            <div className={clsx(styles.diagnostic, done && styles.diagnosticOn)}>
              <span className={styles.gutterSpace} />
              <div className={styles.box}>
                <span className={styles.message}>
                  <span className={styles.error}>error</span>There is no page at this address.
                </span>
                <span className={styles.note}>
                  Diagnostics are on the roadmap. This one is drawn by hand.
                </span>
              </div>
            </div>
          </div>
        </div>
        <div data-in className={styles.actions}>
          <Link to="/start/installation/" className={ui.primary}>
            Start from the installation <span>→</span>
          </Link>
          <button
            type="button"
            className={ui.secondary}
            onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH))}
          >
            Search the docs
          </button>
          <Link to="/" className={styles.ghost}>
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
