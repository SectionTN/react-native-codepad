import useBrokenLinks from '@docusaurus/useBrokenLinks';
import clsx from 'clsx';
import { FX } from './fx';
import { useLoop } from './hooks';
import styles from './Roadmap.module.css';
import { SectionHeader } from './SectionHeader';
import ui from './ui.module.css';

// From the README's roadmap; the first step has shipped.
const STEPS: [string, string][] = [
  ['0.1', 'Android and iOS, fifteen languages, search, themes and the keyboard follower'],
  ['planned', 'Autocomplete and an LSP client'],
  ['planned', 'Code folding and a minimap'],
  ['planned', 'Multiple cursors, diagnostics, font ligatures and bidi editing'],
  ['planned', 'Web'],
  ['1.0', 'The first stable release'],
];

function Shipped() {
  const pulse = useLoop<HTMLSpanElement>(FX.pulse);
  return (
    <>
      <div className={styles.lineDone} />
      <span ref={pulse} className={styles.dotDone} />
      <span className={clsx(styles.dotDone, styles.dotRing)} />
    </>
  );
}

export function Roadmap() {
  useBrokenLinks().collectAnchor('roadmap');
  return (
    <section id="roadmap" className={ui.section}>
      <SectionHeader
        n="07"
        label="roadmap"
        title="Where it goes next."
        lead="0.1 is out. Everything after it is planned in the open, and ideas go to the issues."
        gap={56}
      />
      <div data-reveal className={styles.track}>
        {STEPS.map(([tag, title], i) => (
          <div key={title} className={styles.step}>
            {i === 0 ? (
              <Shipped />
            ) : (
              <>
                <div className={styles.linePlanned} />
                <span className={styles.dotPlanned} />
              </>
            )}
            <div className={clsx(styles.tag, i === 0 && styles.tagDone)}>{tag}</div>
            <div className={styles.title}>{title}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
