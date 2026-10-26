import clsx from 'clsx';
import styles from './Code.module.css';
import type { Capture } from './editorThemes';
import type { Line } from './highlight';

// Site code uses the page palette; editor surfaces read their --e-* theme variables.
const SITE: Partial<Record<Capture, string>> = {
  keyword: 'var(--cp-k)',
  operator: 'var(--cp-k)',
  string: 'var(--cp-s)',
  number: 'var(--cp-n)',
  constant: 'var(--cp-n)',
  property: 'var(--cp-n)',
  attribute: 'var(--cp-n)',
  function: 'var(--cp-f)',
  type: 'var(--cp-t)',
  tag: 'var(--cp-g)',
  comment: 'var(--cp-c)',
};

type Props = { line: Line; palette: 'site' | 'editor'; caretClassName?: string };

export function Runs({ line, palette, caretClassName }: Props) {
  return (
    <>
      {line.map((seg, i) => {
        // biome-ignore lint/suspicious/noArrayIndexKey: runs are positional and rebuilt on every edit
        if ('caret' in seg) return <span key={i} className={caretClassName} />;
        const style =
          palette === 'site'
            ? { color: SITE[seg.capture] ?? 'var(--cp-text)' }
            : { color: `var(--e-${seg.capture})`, opacity: `var(--o-${seg.capture}, 1)` };
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: runs are positional and rebuilt on every edit
            key={i}
            className={clsx(styles.run, styles[seg.capture], seg.paint && styles[seg.paint])}
            style={style}
          >
            {seg.text}
          </span>
        );
      })}
    </>
  );
}
