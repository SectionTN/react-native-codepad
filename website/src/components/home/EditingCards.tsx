import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './EditingCards.module.css';
import { FX } from './fx';
import { blink } from './Hero';
import { type Loop, useLoop } from './hooks';
import { SectionHeader } from './SectionHeader';
import ui from './ui.module.css';

const K = ({ children }: { children: ReactNode }) => (
  <span style={{ color: 'var(--cp-k)' }}>{children}</span>
);
const F = ({ children }: { children: ReactNode }) => (
  <span style={{ color: 'var(--cp-f)' }}>{children}</span>
);
const S = ({ children }: { children: ReactNode }) => (
  <span style={{ color: 'var(--cp-s)' }}>{children}</span>
);
const N = ({ children }: { children: ReactNode }) => (
  <span style={{ color: 'var(--cp-n)' }}>{children}</span>
);

// A span that runs one of the landing's loops.
function Fx({
  fx,
  i = 0,
  className,
  children,
}: {
  fx: Loop;
  i?: number;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useLoop<HTMLSpanElement>(fx, i);
  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  );
}

function FxDiv({
  fx,
  className,
  children,
}: {
  fx: Loop;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useLoop<HTMLDivElement>(fx);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

type CardProps = {
  wide?: boolean;
  delay?: number;
  title: string;
  body: string;
  children: ReactNode;
};

function Card({ wide, delay, title, body, children }: CardProps) {
  return (
    <div
      data-reveal={delay ?? ''}
      className={clsx(ui.card, styles.card, wide ? styles.wide : styles.narrow)}
    >
      {children}
      <div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.body}>{body}</p>
      </div>
    </div>
  );
}

function Selection() {
  return (
    <div className={styles.selectionDemo}>
      <div className={styles.selectionCode}>
        <div className={styles.selectionFirst}>
          <K>const</K> file <K>=</K> <K>await</K> <F>open</F>(path);
        </div>
        <div className={styles.relative}>
          <Fx fx={FX.selbox} className={styles.selBox} />
          <Fx fx={FX.selh} className={styles.handleLeft}>
            <span />
          </Fx>
          <Fx fx={FX.selr} className={styles.handleRight}>
            <span />
          </Fx>
          <FxDiv fx={FX.selmenu} className={styles.menu}>
            <span>Cut</span>
            <span className={styles.menuRule} />
            <span>Copy</span>
            <span className={styles.menuRule} />
            <span>Paste</span>
            <span className={styles.menuRule} />
            <span className={styles.menuMore}>›</span>
          </FxDiv>
          <span className={styles.selectionLine}>
            <K>return</K> <K>await</K> <F>readFile</F>(path, <S>"utf8"</S>);
          </span>
        </div>
      </div>
    </div>
  );
}

function Undo() {
  return (
    <div className={styles.undoDemo}>
      <div className={styles.relative}>
        <FxDiv fx={FX.undoring} className={styles.undoRing}>
          <span>one undo step</span>
        </FxDiv>
        <FxDiv fx={FX.undorow} className={styles.undoRow}>
          {Array.from('answer').map((ch, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: letters repeat
            <Fx key={i} fx={FX.undochip} className={styles.undoChip}>
              <Fx fx={FX.undoskin} className={styles.undoSkin} />
              <span className={styles.relative}>{ch}</span>
            </Fx>
          ))}
        </FxDiv>
      </div>
      <div className={styles.undoKeys}>
        <Fx fx={FX.undokey} className={styles.keycap}>
          ⌘
        </Fx>
        <Fx fx={FX.undokey} className={styles.keycap}>
          Z
        </Fx>
        <span className={styles.undoLabel}>undo</span>
      </div>
    </div>
  );
}

function Pairs() {
  return (
    <div className={styles.pairsDemo}>
      <div className={styles.pairsCode}>
        <div className={styles.pre}>
          <K>if</K> (ready) <Fx fx={FX.popen}>{'{'}</Fx>
          <Fx fx={FX.pc1} className={styles.pairsCaret} />
          <Fx fx={FX.pghost} className={styles.ghost}>
            {'}'}
          </Fx>
        </div>
        <FxDiv fx={FX.pline} className={styles.pairsIndent}>
          <span className={styles.guide} />
          <Fx fx={blink} className={styles.pairsBlink} />
        </FxDiv>
        <FxDiv fx={FX.pline}>
          <span className={styles.closer}>
            {'}'}
            <Fx fx={FX.pflash} className={styles.flash} />
          </span>
        </FxDiv>
      </div>
    </div>
  );
}

function Match({ i }: { i: number }) {
  return (
    <span className={styles.match}>
      retries
      <Fx fx={FX.match} i={i} className={styles.matchActive} />
    </span>
  );
}

function Search() {
  return (
    <div className={styles.searchDemo}>
      <div className={styles.findField}>
        <span className={styles.faint}>find</span>
        <span className={styles.findText}>retries</span>
        <span className={styles.chip}>Aa</span>
        <span className={styles.chipOn}>.*</span>
        <span className={styles.chip}>\b</span>
        <span className={styles.matchCount}>4 matches</span>
      </div>
      <div className={styles.searchCode}>
        <div className={styles.comment}>
          {'// readFile with '}
          <Match i={0} />
        </div>
        <div className={styles.pre}>
          <K>export async function</K> <F>load</F>(path, <Match i={1} /> <K>=</K> <N>3</N>) {'{'}
        </div>
        <div className={styles.pre}>
          {'  '}
          <K>for</K> (<K>let</K> i <K>=</K> <N>0</N>; i <K>{'<'}</K> <Match i={2} />; i<K>++</K>){' '}
          {'{'}
        </div>
        <div className={styles.pre}>
          {'    '}
          <K>if</K> (i <K>===</K> <Match i={3} /> <K>-</K> <N>1</N>) <K>throw</K> error;
        </div>
      </div>
    </div>
  );
}

const CHORDS = [
  ['⌘', 'Z', 'Undo'],
  ['⇧', '⇥', 'Outdent the selected lines'],
  ['⌥', '←', 'Move by one word'],
];

function Chords() {
  return (
    <div className={styles.chordsDemo}>
      {CHORDS.map(([a, b, label], i) => (
        <div key={label} className={styles.chord}>
          <Fx fx={FX.chord} i={i} className={styles.keycap36}>
            {a}
          </Fx>
          <Fx fx={FX.chord} i={i} className={styles.keycap36}>
            {b}
          </Fx>
          <span className={styles.chordLabel}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Toolbar() {
  return (
    <div className={styles.toolbarDemo}>
      <div className={styles.toolbarKeys}>
        {['⇥', '←', '→', '↶', '↷', '⌫'].map((glyph, i) => (
          <span key={glyph} className={styles.toolbarKey}>
            <Fx fx={FX.toolbar} i={i} className={styles.toolbarLit} />
            <span className={styles.relative}>{glyph}</span>
          </span>
        ))}
      </div>
      <div className={styles.toolbarCall}>
        editor.current?.<F>moveCaret</F>(<S>'wordLeft'</S>)
      </div>
    </div>
  );
}

function SoftWrap() {
  return (
    <div className={styles.wrapDemo}>
      <FxDiv fx={FX.wrap} className={styles.wrapBox}>
        <span className={styles.faint}>1</span>
        <span className={styles.wrapText}>
          <K>const</K> message <K>=</K>{' '}
          <S>"a long string literal that keeps going past the edge"</S>
          {';'}
        </span>
      </FxDiv>
    </div>
  );
}

export function EditingCards() {
  return (
    <section className={ui.section}>
      <SectionHeader
        n="03"
        label="editing"
        title="An editor, not a text field."
        lead="No WebView and no TextInput. CodePad draws its own caret, handles and edit menu, and every key runs through the same engine paths."
      />
      <div className={styles.grid}>
        <Card
          wide
          title="Selection that feels native"
          body="Tap, double tap and long press, with handles, the loupe and the platform's own edit menu."
        >
          <Selection />
        </Card>
        <Card
          delay={80}
          title="Undo in whole words"
          body="Keystrokes group into one undo step, so undo takes back what you meant."
        >
          <Undo />
        </Card>
        <Card
          title="Pairs and indents, handled"
          body="Brackets and quotes close as you type. A newline keeps the indent and adds a level inside an open bracket."
        >
          <Pairs />
        </Card>
        <Card
          wide
          delay={80}
          title="Find and replace, every match painted"
          body="Literal or regex, case sensitive and whole word, next and previous, replace one or all in a single undo group."
        >
          <Search />
        </Card>
        <Card
          title="Hardware keyboards"
          body="A full key table on both platforms. These are the iOS chords; Android gets its own."
        >
          <Chords />
        </Card>
        <Card
          delay={80}
          title="Build your own key row"
          body="The toolbar API drives the same paths as the keyboard, straight from JavaScript."
        >
          <Toolbar />
        </Card>
        <Card
          delay={160}
          title="Soft wrap, or scroll"
          body="Wrap long lines or scroll sideways. The gutter and the active line come with both."
        >
          <SoftWrap />
        </Card>
      </div>
    </section>
  );
}
