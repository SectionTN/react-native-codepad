import clsx from 'clsx';
import { PM_ADD, PMS, useCopy, usePackageManager } from './hooks';
import styles from './InstallCommand.module.css';
import ui from './ui.module.css';

export const PACKAGES = 'react-native-codepad react-native-nitro-modules';

export function PmTabs({ className, hero }: { className?: string; hero?: boolean }) {
  const [pm, setPm] = usePackageManager();
  return (
    <div data-hero={hero || undefined} className={clsx(ui.tabs, className)}>
      {PMS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === pm}
          className={clsx(ui.tab, id === pm && ui.tabOn)}
          onClick={() => setPm(id)}
        >
          {id}
        </button>
      ))}
    </div>
  );
}

export function CopyIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path
        d="M13.5 4.5 6.5 11.5 3 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <rect
        x="5.5"
        y="5.5"
        width="8"
        height="8"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// The hero's install line: the selected package manager's add command and a copy button.
export function InstallBox() {
  const [pm] = usePackageManager();
  const [copied, copy] = useCopy();
  const command = `${PM_ADD[pm]} ${PACKAGES}`;
  return (
    <div data-hero className={styles.box}>
      <span className={styles.dollar}>$</span>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (axe scrollable-region-focusable) */}
      <code className={styles.command} tabIndex={0}>
        {command}
      </code>
      <button type="button" className={styles.copy} onClick={() => copy('install', command)}>
        <CopyIcon copied={copied === 'install'} />
        <span>{copied === 'install' ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
}
