import useBaseUrl from '@docusaurus/useBaseUrl';
import clsx from 'clsx';
import { type MouseEvent, useRef } from 'react';
import { FX } from './fx';
import { prefersReducedMotion, useLoop } from './hooks';
import styles from './PlatformPhones.module.css';
import { SectionHeader } from './SectionHeader';
import ui from './ui.module.css';

type Shot = { platform: 'ios' | 'android'; caption: string; ratio: string; name: string };

const SHOTS: Shot[] = [
  {
    platform: 'ios',
    name: 'iOS',
    caption: 'iOS · Swift engine · release build',
    ratio: '760 / 1652',
  },
  {
    platform: 'android',
    name: 'Android',
    caption: 'Android · Kotlin engine · release build',
    ratio: '760 / 1706',
  },
];

const FACTS = [
  ['android', 'A Kotlin engine, from Android 7.0 (API 24).'],
  ['ios', 'A Swift engine, from iOS 17.'],
  ['both', 'One Nitro binding, one JavaScript API, the same test vectors.'],
];
const REQUIRES = [
  'React Native 0.81+',
  'New Architecture',
  'iOS 17+',
  'Android 7.0+ (API 24)',
  'react-native-nitro-modules',
];
const WORKS_WITH = [
  'Expo development builds',
  'react-native-keyboard-controller',
  'react-native-safe-area-context',
];

function Phone({ shot, index }: { shot: Shot; index: number }) {
  const float = useLoop<HTMLDivElement>(FX.float, index);
  const dark = useBaseUrl(`/img/shots/${shot.platform}-dark-js.webp`);
  const light = useBaseUrl(`/img/shots/${shot.platform}-light-md.webp`);
  return (
    <figure className={clsx(styles.figure, index === 1 && styles.lower)}>
      <div ref={float}>
        <div
          className={clsx(styles.device, index === 1 && styles.deviceRight)}
          style={{ aspectRatio: shot.ratio }}
        >
          <img
            src={dark}
            alt={`The example app on ${shot.name} with a JavaScript file open in the dark theme`}
            className={clsx(styles.shot, styles.dark)}
          />
          <img
            src={light}
            alt={`The example app on ${shot.name} with a Markdown file open in the light theme`}
            className={clsx(styles.shot, styles.light)}
          />
        </div>
      </div>
      <figcaption className={styles.caption}>{shot.caption}</figcaption>
    </figure>
  );
}

export function PlatformPhones() {
  const stage = useRef<HTMLDivElement>(null);
  const tilt = (e: MouseEvent<HTMLDivElement>) => {
    const el = stage.current;
    if (!el || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
  };
  const untilt = () => {
    stage.current?.style.setProperty('--ry', '0deg');
    stage.current?.style.setProperty('--rx', '0deg');
  };
  return (
    <section className={ui.section}>
      <SectionHeader
        n="05"
        label="platforms"
        title="Kotlin on Android. Swift on iOS."
        lead="Two engines, each written for its platform and checked against the same test vectors. These are release builds of the example app."
        gap={24}
      />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the tilt follows the pointer and carries no action */}
      <div
        ref={stage}
        data-reveal
        className={styles.stage}
        onMouseMove={tilt}
        onMouseLeave={untilt}
      >
        <div className={styles.glow} />
        {SHOTS.map((shot, i) => (
          <Phone key={shot.platform} shot={shot} index={i} />
        ))}
      </div>
      <div className={styles.facts}>
        {FACTS.map(([label, text], i) => (
          <div key={label} data-reveal={i ? i * 80 : ''} className={styles.fact}>
            <div className={styles.factLabel}>{label}</div>
            <div className={styles.factText}>{text}</div>
          </div>
        ))}
      </div>
      <div data-reveal className={clsx(ui.card, styles.requirements)}>
        <div>
          <div className={clsx(ui.label, styles.listLabel)}>requires</div>
          <div className={styles.chips}>
            {REQUIRES.map((item) => (
              <span key={item} className={styles.chip}>
                {item}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className={clsx(ui.label, styles.listLabel)}>works with</div>
          <div className={styles.chips}>
            {WORKS_WITH.map((item) => (
              <span key={item} className={styles.chip}>
                {item}
              </span>
            ))}
          </div>
          <div className={styles.expo}>
            Expo needs a development build or npx expo prebuild. Expo Go isn't supported.
          </div>
        </div>
      </div>
    </section>
  );
}
