import Link from '@docusaurus/Link';
import { useEffect, useRef } from 'react';
import { REPO } from '../../data/site';
import { GitHubIcon } from '../Mark';
import styles from './Hero.module.css';
import { HeroPhone } from './HeroPhone';
import { EASE_UI, loop, prefersReducedMotion, useLoop } from './hooks';
import { InstallBox, PmTabs } from './InstallCommand';
import ui from './ui.module.css';

const WORDS = ['The', 'native', 'code', 'editor', 'for', 'React'];

const breathe = (el: HTMLElement) =>
  loop(
    el,
    [
      { opacity: 0.7, transform: 'translate(-50%,-50%) scale(.94)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.08)' },
    ],
    7000,
    { direction: 'alternate', easing: 'ease-in-out' },
  );

export const blink = (el: HTMLElement) =>
  loop(
    el,
    [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }],
    1100,
  );

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const glow = useLoop<HTMLDivElement>(breathe);
  const caret = useLoop<HTMLSpanElement>(blink);

  useEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const entrance = [
      ...Array.from(el.querySelectorAll<HTMLElement>('[data-word]')).map((word, i) =>
        word.animate(
          [
            { opacity: 0, transform: 'translateY(.35em)', filter: 'blur(10px)' },
            { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
          ],
          { duration: 900, delay: 120 + i * 70, easing: EASE_UI, fill: 'backwards' },
        ),
      ),
      ...Array.from(el.querySelectorAll<HTMLElement>('[data-hero]')).map((block, i) =>
        block.animate(
          [
            { opacity: 0, transform: 'translateY(16px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 800, delay: 520 + i * 90, easing: EASE_UI, fill: 'backwards' },
        ),
      ),
    ];
    return () => {
      for (const a of entrance) a.cancel();
    };
  }, []);

  return (
    <header ref={root} className={styles.hero}>
      <div className={styles.rules} />
      <div ref={glow} className={styles.glow} />
      <div className={styles.inner}>
        <div className={styles.left}>
          <a data-hero href={`${REPO}/releases`} className={styles.release}>
            <span className={styles.chip}>0.1</span>
            <span>Out now for Android and iOS</span>
            <span className={styles.arrow}>→</span>
          </a>
          <h1 className={styles.title}>
            {WORDS.map((word) => (
              <span key={word}>
                <span data-word className={word === 'native' ? styles.accentWord : styles.word}>
                  {word}
                </span>{' '}
              </span>
            ))}
            <span data-word className={styles.word}>
              Native.
              <span ref={caret} className={styles.blink} />
            </span>
          </h1>
          <p data-hero className={styles.lead}>
            Its own engine in Kotlin and Swift, tree-sitter highlighting and a Nitro binding. Not a
            WebView in sight.
          </p>
          <PmTabs hero />
          <InstallBox />
          <div data-hero className={styles.actions}>
            <Link to="/start/installation/" className={ui.primary}>
              Get started <span>→</span>
            </Link>
            <a href={REPO} className={ui.secondary}>
              <GitHubIcon size={17} />
              GitHub
            </a>
          </div>
          <dl data-hero className={styles.facts}>
            <div>
              <dt className={ui.label}>Engine</dt>
              <dd>Kotlin and Swift</dd>
            </div>
            <div>
              <dt className={ui.label}>Highlighting</dt>
              <dd>tree-sitter, 15 languages</dd>
            </div>
            <div>
              <dt className={ui.label}>Binding</dt>
              <dd>Nitro, New Architecture</dd>
            </div>
          </dl>
        </div>
        <HeroPhone />
      </div>
    </header>
  );
}
