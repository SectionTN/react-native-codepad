import type { ReactNode } from 'react';
import ui from './ui.module.css';

export function Eyebrow({ n, label }: { n: string; label: string }) {
  return (
    <div className={ui.eyebrow}>
      <span className={ui.slashes}>{'//'}</span>
      <span className={ui.number}>{n}</span>
      <span>{label}</span>
    </div>
  );
}

type Props = { n: string; label: string; title: string; lead: ReactNode; gap?: number };

// Eyebrow and h2 on the left, the lead on the right, wrapping under each other on a phone.
export function SectionHeader({ n, label, title, lead, gap }: Props) {
  return (
    <div
      data-reveal
      className={ui.head}
      style={gap === undefined ? undefined : { marginBottom: gap }}
    >
      <div className={ui.headText}>
        <Eyebrow n={n} label={label} />
        <h2 className={ui.h2}>{title}</h2>
      </div>
      <p className={ui.lead}>{lead}</p>
    </div>
  );
}
