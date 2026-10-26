import clsx from 'clsx';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Runs } from './Code';
import { type EditorThemeKey, editorVars } from './editorThemes';
import styles from './HeroPhone.module.css';
import { capturesOf, findAll, linesOf } from './highlight';
import { EASE_IN, EASE_OUT, prefersReducedMotion } from './hooks';
import {
  CAPTIONS,
  type Doc,
  HERO_SCRIPT,
  KEYBOARD_KEYS,
  keyDelays,
  press,
  QUERY,
  REPLACEMENT,
  replaceAll,
  SNAPSHOTS,
  TYPED,
} from './story';

type Platform = 'ios' | 'android';
type Story = Doc & {
  typing: boolean;
  findOpen: boolean;
  focus: 'query' | 'replace' | null;
  query: string;
  replace: string;
  active: number;
  flash: [number, number][] | null;
  replaced: number;
  allDown: boolean;
  heroTheme: EditorThemeKey | null;
  chapter: number;
  caption: string;
};
type Step = { ms: number; run: () => void };

const KB_H = 216;
const ROW = 19;
const SCREEN_H = 606;
const CODE_TOP = 96;
const BAR_H = 58;
const CHAPTERS = ['Type', 'Search', 'Keyboard', 'Theme'];
const ENTRY_CAPTIONS = [
  CAPTIONS.type,
  CAPTIONS.search,
  CAPTIONS.keyboard,
  CAPTIONS.theme('oneDark'),
];

const START: Story = {
  ...SNAPSHOTS[0],
  typing: true,
  findOpen: false,
  focus: null,
  query: '',
  replace: '',
  active: -1,
  flash: null,
  replaced: 0,
  allDown: false,
  heroTheme: null,
  chapter: 0,
  caption: CAPTIONS.type,
};

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((row) => Array.from(row));

function Keys({ keys }: { keys: string[] }) {
  return keys.map((k) => (
    <span key={k} data-key={k} className={styles.key}>
      {k}
    </span>
  ));
}

// The landing's phone: a scripted editor that types, searches, rides the keyboard and switches themes.
export function HeroPhone() {
  const [platform, setPlatform] = useState<Platform>('ios');
  const [story, setStory] = useState<Story>(START);
  const current = useRef(story);
  const platformRef = useRef(platform);
  const screen = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const keyboard = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const director = useRef<((chapter: number) => void) | null>(null);

  useEffect(() => {
    const set = (patch: Partial<Story> | ((s: Story) => Partial<Story>)) => {
      const next = {
        ...current.current,
        ...(typeof patch === 'function' ? patch(current.current) : patch),
      };
      current.current = next;
      setStory(next);
    };
    if (prefersReducedMotion()) {
      set({ ...TYPED, typing: false });
      return;
    }

    let seq = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let kbUp = false;

    const follow = (ms: number, easing = 'ease-out') => {
      const el = content.current;
      if (!el) return;
      const { text, caret } = current.current;
      const line = text.slice(0, caret).split('\n').length;
      const avail = SCREEN_H - CODE_TOP - (kbUp ? KB_H : 0) - BAR_H;
      el.style.transition = `transform ${ms}ms ${easing}`;
      el.style.transform = `translateY(${-Math.max(0, line * ROW - avail)}px)`;
    };
    const slide = (up: boolean) => {
      const options: KeyframeAnimationOptions = {
        duration: 440,
        easing: up ? EASE_OUT : EASE_IN,
        fill: 'forwards',
      };
      const lift = platformRef.current === 'ios' ? KB_H - 14 : KB_H;
      for (const a of keyboard.current?.getAnimations() ?? []) a.cancel();
      keyboard.current?.animate(
        [
          { transform: `translateY(${up ? 100 : 0}%)` },
          { transform: `translateY(${up ? 0 : 100}%)` },
        ],
        options,
      );
      for (const a of bar.current?.getAnimations() ?? []) a.cancel();
      bar.current?.animate(
        [
          { transform: `translateY(${up ? 0 : -lift}px)` },
          { transform: `translateY(${up ? -lift : 0}px)` },
        ],
        options,
      );
      kbUp = up;
      follow(440, options.easing);
    };
    const resetKeyboard = () => {
      for (const el of [keyboard.current, bar.current])
        for (const a of el?.getAnimations() ?? []) a.cancel();
      kbUp = false;
      if (content.current) {
        content.current.style.transition = 'none';
        content.current.style.transform = '';
      }
    };
    const pop = (k: string) => {
      const key = k === ' ' ? 'space' : /[a-z]/i.test(k) ? k.toLowerCase() : null;
      const el = key ? screen.current?.querySelector<HTMLElement>(`[data-key="${key}"]`) : null;
      el?.animate(
        [
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: 'translateY(-4px) scale(1.15)', filter: 'brightness(1.6)', offset: 0.3 },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 220, easing: 'ease-out' },
      );
    };

    const delays = keyDelays();
    const type: Step[] = Array.from(HERO_SCRIPT).map((k, i) => ({
      ms: delays.typing[i],
      run: () => set((s) => ({ ...press(s, k), typing: true })),
    }));
    type.push({ ms: 1000, run: () => set({ typing: false }) });

    const search: Step[] = [
      { ms: 420, run: () => set({ findOpen: true, focus: 'query', caption: CAPTIONS.search }) },
    ];
    for (let i = 1; i <= QUERY.length; i++)
      search.push({ ms: 80, run: () => set({ query: QUERY.slice(0, i) }) });
    for (let a = 0; a < 4; a++)
      search.push({ ms: a === 0 ? 560 : 420, run: () => set({ active: a }) });
    search.push({ ms: 220, run: () => set({ focus: 'replace' }) });
    for (let i = 1; i <= REPLACEMENT.length; i++) {
      search.push({ ms: 70, run: () => set({ replace: REPLACEMENT.slice(0, i) }) });
    }
    search.push({ ms: 170, run: () => set({ allDown: true }) });
    search.push({
      ms: 1100,
      run: () =>
        set((s) => {
          const r = replaceAll(s, QUERY, REPLACEMENT);
          return {
            text: r.text,
            caret: r.caret,
            flash: r.flash,
            active: -1,
            allDown: false,
            replaced: r.count,
            caption: CAPTIONS.replace,
          };
        }),
    });
    search.push({ ms: 600, run: () => set({ flash: null }) });
    search.push({
      ms: 700,
      run: () => set({ findOpen: false, focus: null, query: '', replace: '', replaced: 0 }),
    });

    const ride: Step[] = [
      {
        ms: 560,
        run: () => {
          set({ caption: CAPTIONS.keyboard });
          slide(true);
        },
      },
    ];
    Array.from(KEYBOARD_KEYS).forEach((k, i) => {
      ride.push({
        ms: delays.keyboard[i],
        run: () => {
          set((s) => ({ ...press(s, k), typing: true }));
          follow(140);
          pop(k);
        },
      });
    });
    ride.push({ ms: 900, run: () => set({ typing: false }) });
    ride.push({ ms: 800, run: () => slide(false) });

    const dark = () => document.documentElement.dataset.theme !== 'light';
    const themed = (key: () => EditorThemeKey): Step => ({
      ms: 1700,
      run: () => {
        const k = key();
        set({ heroTheme: k, caption: CAPTIONS.theme(k) });
      },
    });
    const theme: Step[] = [
      themed(() => 'oneDark'),
      themed(() => (dark() ? 'githubLight' : 'githubDark')),
      themed(() => (dark() ? 'githubDark' : 'githubLight')),
    ];

    const chapters = [type, search, ride, theme];
    const durations = chapters.map((steps) => steps.reduce((sum, step) => sum + step.ms, 0));

    const enter = (chapter: number) => {
      resetKeyboard();
      set({
        ...SNAPSHOTS[chapter],
        chapter,
        findOpen: false,
        focus: null,
        query: '',
        replace: '',
        active: -1,
        flash: null,
        replaced: 0,
        allDown: false,
        heroTheme: null,
        typing: chapter === 0,
        caption: ENTRY_CAPTIONS[chapter],
      });
      fills.current.forEach((el, i) => {
        if (!el) return;
        for (const a of el.getAnimations()) a.cancel();
        el.style.transform = i < chapter ? 'scaleX(1)' : 'scaleX(0)';
        if (i === chapter) {
          el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
            duration: durations[chapter],
            easing: 'linear',
            fill: 'forwards',
          });
        }
      });
    };
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });
    const play = async (from: number) => {
      const id = ++seq;
      clearTimeout(timer);
      for (let chapter = from; id === seq; chapter = (chapter + 1) % chapters.length) {
        enter(chapter);
        for (const step of chapters[chapter]) {
          if (id !== seq) return;
          step.run();
          await wait(step.ms);
        }
      }
    };

    director.current = (chapter) => void play(chapter);
    void play(0);
    return () => {
      seq++;
      clearTimeout(timer);
      director.current = null;
    };
  }, []);

  const replayOnPlatform = useRef(false);
  useEffect(() => {
    platformRef.current = platform;
    if (replayOnPlatform.current) director.current?.(current.current.chapter);
    replayOnPlatform.current = true;
  }, [platform]);

  const caps = useMemo(() => capturesOf(story.text, 'javascript'), [story.text]);
  const matches = story.findOpen && story.query ? findAll(story.text, story.query) : [];
  const lines = linesOf(story.text, caps, {
    caret: story.focus ? -1 : story.caret,
    matches,
    active: story.active,
    flash: story.flash,
  });
  const caretLine = story.text.slice(0, story.caret).split('\n').length - 1;
  const column = story.caret - (story.text.lastIndexOf('\n', story.caret - 1) + 1);
  const count = story.replaced
    ? `${story.replaced} replaced`
    : story.query
      ? `${story.active >= 0 ? story.active + 1 : '-'}/${matches.length}`
      : '';
  const caption = useMemo(
    () => linesOf(story.caption, capturesOf(story.caption, 'tsx'))[0],
    [story.caption],
  );
  const ios = platform === 'ios';
  const status = (
    <>
      <span className={styles.ink}>
        Ln {caretLine + 1}, Col {column + 1}
      </span>
      <span>JavaScript</span>
      <span>Spaces 2</span>
      <span className={styles.fill} />
      <span>opened in 10 ms</span>
    </>
  );

  return (
    <div className={styles.column}>
      <div className={styles.platforms}>
        {(['ios', 'android'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={clsx(styles.platform, platform === id && styles.platformOn)}
            onClick={() => setPlatform(id)}
          >
            {id === 'ios' ? 'iOS' : 'Android'}
          </button>
        ))}
      </div>
      <div className={styles.phone}>
        <div
          ref={screen}
          className={styles.screen}
          data-etheme={story.heroTheme ?? 'site'}
          style={story.heroTheme ? (editorVars(story.heroTheme) as CSSProperties) : undefined}
        >
          {ios ? (
            <>
              <div className={styles.iosStatus}>
                <span>9:41</span>
                <span className={styles.iosIcons}>
                  <span className={styles.signal}>
                    <span style={{ height: 4 }} />
                    <span style={{ height: 6 }} />
                    <span style={{ height: 8 }} />
                    <span style={{ height: 10 }} />
                  </span>
                  <span className={styles.battery}>
                    <span />
                  </span>
                </span>
              </div>
              <div className={styles.island} />
              <div className={styles.iosHeader}>
                <div className={styles.iosTitle}>
                  <span>sample.js</span>
                  <span className={styles.updown}>
                    <span />
                    <span />
                  </span>
                </div>
                <span className={clsx(styles.round, styles.roundSearch)}>
                  <span />
                  <span />
                </span>
                <span className={styles.round}>
                  <span className={styles.more}>
                    <span />
                    <span />
                    <span />
                  </span>
                </span>
              </div>
            </>
          ) : (
            <div className={styles.androidTop}>
              <div className={styles.androidStatus}>
                <span>9:41</span>
                <span className={styles.androidIcons}>
                  <span className={styles.androidSignal}>
                    <span style={{ height: 3 }} />
                    <span style={{ height: 5 }} />
                    <span style={{ height: 7 }} />
                    <span style={{ height: 9 }} />
                  </span>
                  <span className={styles.androidBattery} />
                </span>
              </div>
              <div className={styles.camera} />
              <div className={styles.appBar}>
                <span className={styles.appTitle}>sample.js</span>
                <span className={styles.caretDown} />
                <span className={styles.fill} />
                <span className={styles.androidSearch}>
                  <span />
                  <span />
                </span>
                <span className={styles.kebab}>
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          )}

          <div className={clsx(styles.find, story.findOpen && styles.findOpen)}>
            <div className={styles.findRow}>
              <div className={clsx(styles.field, story.focus === 'query' && styles.fieldOn)}>
                <span className={styles.fieldLabel}>find</span>
                <span className={styles.fieldText}>
                  {story.query}
                  {story.focus === 'query' && <span className={styles.fieldCaret} />}
                </span>
                <span className={styles.count}>{count}</span>
              </div>
              <span className={styles.arrow}>↑</span>
              <span className={styles.arrow}>↓</span>
            </div>
            <div className={styles.findRow}>
              <div className={clsx(styles.field, story.focus === 'replace' && styles.fieldOn)}>
                <span className={styles.fieldLabel}>with</span>
                <span className={styles.fieldText}>
                  {story.replace}
                  {story.focus === 'replace' && <span className={styles.fieldCaret} />}
                </span>
              </div>
              <span className={clsx(styles.all, story.allDown && styles.allDown)}>All</span>
            </div>
          </div>

          <div className={styles.code} style={{ top: story.findOpen ? CODE_TOP + 80 : CODE_TOP }}>
            <div ref={content} className={styles.content}>
              {lines.map((line, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: a row is its line number
                  key={i}
                  className={clsx(styles.row, i === caretLine && !story.focus && styles.rowActive)}
                >
                  <span className={clsx(styles.gutter, i === caretLine && styles.gutterActive)}>
                    {i + 1}
                  </span>
                  <span className={styles.text}>
                    <Runs
                      line={line}
                      palette="editor"
                      caretClassName={clsx(styles.caret, !story.typing && styles.caretIdle)}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {ios ? (
            <>
              <div ref={bar} className={styles.pill}>
                {status}
              </div>
              <div className={styles.home} />
            </>
          ) : (
            <div ref={bar} className={styles.androidBar}>
              {status}
              <span className={styles.gesture} />
            </div>
          )}

          <div ref={keyboard} className={styles.keyboard}>
            <div className={styles.keyRow}>
              <Keys keys={ROWS[0]} />
            </div>
            <div className={clsx(styles.keyRow, styles.keyRowInset)}>
              <Keys keys={ROWS[1]} />
            </div>
            <div className={styles.keyRow}>
              <span className={clsx(styles.key, styles.keyMod)} style={{ flex: 1.5, fontSize: 14 }}>
                ⇧
              </span>
              <Keys keys={ROWS[2]} />
              <span className={clsx(styles.key, styles.keyMod)} style={{ flex: 1.5, fontSize: 14 }}>
                ⌫
              </span>
            </div>
            <div className={styles.keyRow}>
              <span className={clsx(styles.key, styles.keyMod)} style={{ flex: 1.3, fontSize: 13 }}>
                123
              </span>
              <span data-key="space" className={styles.key} style={{ flex: 5, fontSize: 13 }}>
                space
              </span>
              <span className={clsx(styles.key, styles.keyMod)} style={{ flex: 1.8, fontSize: 13 }}>
                return
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.chapters}>
        {CHAPTERS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={styles.chapter}
            onClick={() => director.current?.(i)}
          >
            <span className={clsx(styles.chapterLabel, i === story.chapter && styles.chapterOn)}>
              {label}
            </span>
            <span className={styles.track}>
              <span
                ref={(el) => {
                  fills.current[i] = el;
                }}
                className={styles.trackFill}
              />
            </span>
          </button>
        ))}
      </div>
      <div className={styles.caption}>
        <Runs line={caption} palette="site" />
      </div>
    </div>
  );
}
