import keyboard from '!!raw-loader!../../snippets/keyboard.tsx';
import clsx from 'clsx';
import { Runs } from './Code';
import { curve, FX } from './fx';
import { blink } from './Hero';
import { capturesOf, linesOf } from './highlight';
import { useLoop } from './hooks';
import styles from './KeyboardFollow.module.css';
import { PALETTE } from './Marquee';
import { Eyebrow } from './SectionHeader';
import ui from './ui.module.css';

const SNIPPET = keyboard.trimEnd();
const LINES = linesOf(SNIPPET, capturesOf(SNIPPET, 'tsx'));
const HIGHLIGHT = SNIPPET.split('\n').findIndex((line) => line.trim() === 'avoidKeyboard');

// Line widths in percent and indent levels of the mock document; the caret sits on line 13.
const WIDTHS = [62, 78, 0, 54, 70, 46, 82, 58, 0, 66, 74, 40, 52, 30];
const INDENTS = [0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 1, 1, 2, 0];
const KEYS = [8, 8, 7, 3];

function Dot({ i }: { i: number }) {
  const ref = useLoop<HTMLSpanElement>(FX.dot, i);
  return (
    <span
      ref={ref}
      className={styles.dot}
      style={{ left: `${(i / 15) * 100}%`, bottom: `${curve(i) * 100}%` }}
    />
  );
}

export function KeyboardFollow() {
  const lines = useLoop<HTMLDivElement>(FX.keyboardLines);
  const board = useLoop<HTMLDivElement>(FX.keyboard);
  const caret = useLoop<HTMLSpanElement>(blink);
  return (
    <section className={ui.section}>
      <div className={styles.split}>
        <div data-reveal className={styles.copy}>
          <Eyebrow n="04" label="keyboard" />
          <h2 className={ui.h2}>It rides the keyboard.</h2>
          <p className={styles.lead}>
            Turn on avoidKeyboard and the keyboard's overlap goes into the bottom inset on every
            frame of its animation. The caret never ends up behind it.
          </p>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (axe scrollable-region-focusable) */}
          <div className={styles.snippet} tabIndex={0}>
            {LINES.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a row is its line number
              <div key={i} className={clsx(styles.line, i === HIGHLIGHT && styles.lineOn)}>
                <span className={styles.gutter}>{i + 1}</span>
                <span className={styles.text}>
                  <Runs line={line} palette="site" />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div data-reveal="80" className={clsx(ui.card, styles.card)}>
          <div className={styles.mock}>
            <div ref={lines} className={styles.mockLines}>
              {WIDTHS.map((width, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: mock lines are positional
                <div key={i} className={styles.mockLine}>
                  <span
                    className={styles.bar}
                    style={{
                      width: `${width}%`,
                      marginLeft: INDENTS[i] * 12,
                      background: PALETTE[i % 6],
                      opacity: width ? 0.8 : 0,
                    }}
                  />
                  {i === 12 && <span ref={caret} className={styles.caret} />}
                </div>
              ))}
            </div>
            <div ref={board} className={styles.keyboard}>
              <div className={styles.inset} />
              <span className={styles.insetLabel}>bottom inset</span>
              {KEYS.map((count, r) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: key rows are positional
                <div key={r} className={styles.keyRow}>
                  {Array.from({ length: count }, (_, k) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: keys are positional
                    <span key={k} className={styles.key} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.plotColumn}>
            <div className={styles.plotTitle}>bottom inset, frame by frame</div>
            <div className={styles.plot}>
              <div className={styles.plotArea}>
                {Array.from({ length: 16 }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: one dot per frame
                  <Dot key={i} i={i} />
                ))}
              </div>
            </div>
            <div className={styles.axis}>
              <span>frame 0</span>
              <span>frame 15</span>
            </div>
            <p className={styles.caption}>
              Each dot is one frame of the keyboard animation, slowed down 4×. The inset follows the
              curve, not a fixed jump.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
