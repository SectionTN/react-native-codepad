import useBrokenLinks from '@docusaurus/useBrokenLinks';
import clsx from 'clsx';
import { FX } from './fx';
import { useLoop } from './hooks';
import styles from './Roadmap.module.css';
import { SectionHeader } from './SectionHeader';
import ui from './ui.module.css';

// From the README's roadmap. The first SHIPPED steps are released, the last of them pulses.
const SHIPPED = 4;
const STEPS: [string, string][] = [
  ['0.1', 'Android and iOS, fifteen languages, search, themes and the keyboard follower'],
  [
    '0.1.3 and 0.1.4',
    'Text padding, one font name for both platforms and horizontal scroll in a ScrollView',
  ],
  ['0.1.6', 'Decorations: underlines, space under a line and line backgrounds'],
  ['0.1.7', 'PHP and SQL language packages'],
  ['planned', 'Autocomplete and an LSP client'],
  ['planned', 'Code folding and a minimap'],
  ['planned', 'Multiple cursors, diagnostics, font ligatures and bidi editing'],
  ['planned', 'Web'],
  ['1.0', 'The first stable release'],
];

function Latest() {
  const pulse = useLoop<HTMLSpanElement>(FX.pulse);
  return (
    <>
      <div className={styles.lineDone} />
      <span ref={pulse} className={styles.dotDone} />
      <span className={clsx(styles.dotDone, styles.dotRing)} />
    </>
  );
}

function Shipped() {
  return (
    <>
      <div className={styles.lineShipped} />
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
        lead="Released steps are on npm. Everything after them is planned in the open, and ideas go to the issues."
        gap={56}
      />
      <div data-reveal className={styles.track}>
        {STEPS.map(([tag, title], i) => (
          <div key={title} className={styles.step}>
            {i === SHIPPED - 1 ? (
              <Latest />
            ) : i < SHIPPED ? (
              <Shipped />
            ) : (
              <>
                <div className={styles.linePlanned} />
                <span className={styles.dotPlanned} />
              </>
            )}
            <div className={clsx(styles.tag, i < SHIPPED && styles.tagDone)}>{tag}</div>
            <div className={styles.title}>{title}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
