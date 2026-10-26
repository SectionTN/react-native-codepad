import clsx from 'clsx';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Runs } from './Code';
import {
  CAPTURES,
  type Capture,
  captureColor,
  EDITOR_THEMES,
  type EditorThemeKey,
  editorVars,
} from './editorThemes';
import { capturesOf, countTokens, linesOf } from './highlight';
import { EASE_UI, PM_ADD, prefersReducedMotion, useCopy, usePackageManager } from './hooks';
import styles from './Playground.module.css';
import { SectionHeader } from './SectionHeader';
import { LANGUAGES, type Language, SAMPLES } from './samples';
import ui from './ui.module.css';

const THEME_KEYS: EditorThemeKey[] = ['githubDark', 'oneDark', 'githubLight'];
const LEGEND: [string, Capture[]][] = [
  ['keyword', ['keyword']],
  ['string', ['string']],
  ['function', ['function']],
  ['type', ['type']],
  ['number', ['number', 'constant']],
  ['property', ['property', 'attribute']],
  ['tag', ['tag']],
  ['comment', ['comment']],
  ['markup', ['heading', 'strong', 'link']],
  ['punctuation', ['punctuation', 'operator']],
];

// Pick a language and a theme; hovering a capture dims every other one.
export function Playground() {
  const [lang, setLang] = useState<Language>('typescript');
  const [theme, setTheme] = useState<EditorThemeKey | null>(null);
  const [focus, setFocus] = useState<Capture[] | null>(null);
  const [pm] = usePackageManager();
  const [copied, copy] = useCopy();
  const code = useRef<HTMLDivElement>(null);
  const [file, source] = SAMPLES[lang];
  const lines = useMemo(() => linesOf(source, capturesOf(source, lang)), [source, lang]);
  const counts = useMemo(() => countTokens(source, lang), [source, lang]);

  const swept = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the sweep replays when the language changes
  useEffect(() => {
    if (!swept.current) {
      swept.current = true;
      return;
    }
    if (prefersReducedMotion()) return;
    code.current?.querySelectorAll<HTMLElement>('[data-line]').forEach((row, i) => {
      row.animate(
        [
          { opacity: 0, transform: 'translateX(-10px)', filter: 'blur(4px)' },
          { opacity: 1, transform: 'translateX(0)', filter: 'blur(0)' },
        ],
        { duration: 460, delay: i * 24, easing: EASE_UI, fill: 'backwards' },
      );
    });
  }, [lang]);

  const style: Record<string, string> = theme ? editorVars(theme) : {};
  if (focus) for (const c of CAPTURES) style[`--o-${c}`] = focus.includes(c) ? '1' : '0.14';
  const command = `${PM_ADD[pm]} react-native-codepad-lang-${lang}`;

  return (
    <section className={ui.section}>
      <SectionHeader
        n="02"
        label="highlighting"
        title="Fifteen languages. Ship only yours."
        lead="Every grammar is its own npm package, parsed by tree-sitter. Pick a language and a theme, then hover a capture to see what it paints."
      />
      <div
        data-reveal
        data-etheme={theme ?? 'site'}
        className={clsx(styles.window, !theme && styles.auto)}
        style={style as CSSProperties}
      >
        <div className={styles.top}>
          <div className={styles.file}>
            <span className={styles.fileDot} />
            {file}
          </div>
          <div className={styles.themes}>
            {THEME_KEYS.map((key) => {
              const t = EDITOR_THEMES[key].theme;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={key === theme}
                  className={clsx(
                    styles.theme,
                    key === theme && styles.themeOn,
                    key === 'githubDark' && styles.siteDark,
                    key === 'githubLight' && styles.siteLight,
                  )}
                  onClick={() => setTheme(key)}
                >
                  <span className={styles.swatch} style={{ background: t.background }}>
                    {(['keyword', 'string', 'function'] as const).map((c) => (
                      <span key={c} style={{ background: captureColor(t, c) }} />
                    ))}
                  </span>
                  {EDITOR_THEMES[key].label}
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.langs}>
          {LANGUAGES.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === lang}
              className={clsx(styles.lang, id === lang && styles.langOn)}
              onClick={() => setLang(id)}
            >
              {id}
            </button>
          ))}
        </div>
        <div className={styles.body}>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (axe scrollable-region-focusable) */}
          <div ref={code} className={styles.code} tabIndex={0}>
            {lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a row is its line number
              <div key={`${lang}-${i}`} data-line className={styles.line}>
                <span className={styles.gutter}>{i + 1}</span>
                <span className={styles.text}>
                  <Runs line={line} palette="editor" />
                </span>
              </div>
            ))}
          </div>
          <div className={styles.captures}>
            <div className={styles.capturesTitle}>captures in this file</div>
            {LEGEND.map(([name, caps]) => {
              const n = caps.reduce((sum, c) => sum + (counts[c] ?? 0), 0);
              return (
                <button
                  key={name}
                  type="button"
                  className={styles.capture}
                  style={{ opacity: n ? 1 : 0.35 }}
                  onMouseEnter={() => setFocus(caps)}
                  onMouseLeave={() => setFocus(null)}
                  onFocus={() => setFocus(caps)}
                  onBlur={() => setFocus(null)}
                >
                  <span
                    className={styles.captureSwatch}
                    style={{ background: `var(--e-${caps[0]})` }}
                  />
                  <span className={styles.captureName}>@{name}</span>
                  <span className={styles.captureCount}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.foot}>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (axe scrollable-region-focusable) */}
          <span className={styles.footCommand} tabIndex={0}>
            <span className={styles.footDollar}>$</span> {command}
          </span>
          <button type="button" className={styles.footCopy} onClick={() => copy('lang', command)}>
            {copied === 'lang' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </section>
  );
}
