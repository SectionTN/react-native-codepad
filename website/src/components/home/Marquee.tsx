import { FX } from './fx';
import { useLoop } from './hooks';
import styles from './Marquee.module.css';

const ITEMS = [
  'selection handles',
  'the loupe',
  'edit menu',
  'undo and redo',
  'auto indent',
  'auto-closing pairs',
  'bracket matching',
  'active line',
  'line numbers',
  'soft wrap',
  'regex search',
  'replace all',
  'hardware keys',
  'toolbar API',
  'read only mode',
  'placeholder',
  'content insets',
  'scroll to line',
];
export const PALETTE = [
  'var(--cp-k)',
  'var(--cp-f)',
  'var(--cp-s)',
  'var(--cp-n)',
  'var(--cp-t)',
  'var(--cp-g)',
];

// The list runs twice and slides by half its width, so the loop has no seam.
export function Marquee() {
  const track = useLoop<HTMLDivElement>(FX.marquee);
  return (
    <div className={styles.band}>
      <div ref={track} className={styles.track}>
        {[...ITEMS, ...ITEMS].map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the second copy repeats every label
          <span key={i} className={styles.item} aria-hidden={i >= ITEMS.length || undefined}>
            <span className={styles.dot} style={{ background: PALETTE[i % 6] }} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
