import { FIGURES } from '../../data/figures';
import { REPO } from '../../data/site';
import styles from './FrameBudget.module.css';
import { FX } from './fx';
import { useLoop } from './hooks';
import { SectionHeader } from './SectionHeader';
import ui from './ui.module.css';

// 30 frames of 16.7 ms at 40x slow motion; a key lands every 9th frame, about every 150 ms.
const TRAIN = Array.from({ length: 60 }, (_, i) => i % 9 === 3);

export function FrameBudget() {
  const train = useLoop<HTMLDivElement>(FX.train);
  return (
    <section className={ui.section}>
      <SectionHeader
        n="01"
        label="speed"
        title="Every keystroke lands inside the frame."
        lead="Handling a key and drawing the result takes 3 ms on a 10,000 line file. A frame at 60 Hz is 16.7 ms. The rest is yours."
      />
      <div data-reveal className={`${ui.card} ${styles.card}`}>
        <div className={styles.row}>
          <span>one frame at 60 Hz</span>
          <span>16.7 ms</span>
        </div>
        <div className={styles.bar}>
          <div data-onreveal="budget" className={styles.used}>
            3 ms
          </div>
          <div className={styles.left}>13.7 ms left over</div>
        </div>
        <div className={styles.method}>
          work per keystroke · 10,000 line file · iOS, debug build · median of 60 keys
        </div>
        <div className={styles.trainHead}>
          <span>Frames go by. A key lands every 150 ms, as in the benchmark.</span>
          <span className={styles.slow}>slowed down 40×</span>
        </div>
        <div className={styles.window}>
          <div ref={train} className={styles.train}>
            {TRAIN.map((key, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: frames are positional
              <div key={i} className={styles.slot}>
                <div className={styles.frame}>
                  {key && (
                    <>
                      <div className={styles.work} />
                      <span className={styles.key}>key</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.stats}>
        {FIGURES.map((figure, i) => {
          const [amount, unit] = figure.value.split(' ');
          return (
            <div
              key={figure.value}
              data-reveal={i ? i * 80 : ''}
              className={`${ui.card} ${styles.stat}`}
            >
              <div className={styles.value}>
                <span data-count={amount.replace(/,/g, '')}>{amount}</span>
                <span className={styles.unit}> {unit}</span>
              </div>
              <div className={styles.label}>{figure.label}</div>
              <div className={styles.where}>{figure.where.replace(/^on /, '')}</div>
            </div>
          );
        })}
      </div>
      <p className={styles.note}>
        Simulator and emulator numbers, re-measured before each release to catch regressions.
        Numbers from a real device are welcome in an <a href={`${REPO}/issues`}>issue</a>.
      </p>
    </section>
  );
}
