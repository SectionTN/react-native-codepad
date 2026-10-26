import clsx from 'clsx';
import styles from './Mark.module.css';

// The </> mark from static/img/logo.svg, inline so it takes the accent through currentColor.
export function Mark({ size = 32, className }: { size?: 30 | 32; className?: string }) {
  const glyph = size === 32 ? 18 : 17;
  return (
    <span
      className={clsx(styles.tile, className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width={glyph}
        height={glyph}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 7l-5 5 5 5" />
        <path d="M16 7l5 5-5 5" />
        <path d="M12 4v16" />
      </svg>
    </span>
  );
}

export function GitHubIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.1 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  );
}
