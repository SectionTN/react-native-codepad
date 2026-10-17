import highlight from '!!raw-loader!../snippets/highlight.tsx';
import keyboard from '!!raw-loader!../snippets/keyboard.tsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import CodeBlock from '@theme/CodeBlock';
import Layout from '@theme/Layout';
import clsx from 'clsx';
import { type ReactNode, useState } from 'react';
import { FIGURES } from '../data/figures';
import styles from './index.module.css';

const INSTALL = 'npm install react-native-codepad react-native-nitro-modules';
const REPO = 'https://github.com/SectionTN/react-native-codepad';
const FRAME_MS = 16.7;

const EDITING = [
  ['Selection', 'with handles, the loupe and the edit menu'],
  ['Undo and redo', 'with keystrokes grouped into one undo step'],
  ['Auto indent', 'and auto closing brackets and quotes'],
  ['Tab and Shift+Tab', 'to indent and outdent, plus bracket matching and an active line'],
  ['Search', 'literal or regex, replace one or all, every match painted'],
  ['Hardware keys', 'with the full key table'],
  ['A toolbar API', 'that drives the same paths from JavaScript'],
  ['Three themes', 'keyed by nvim-treesitter capture names'],
] as const;

const WORKS_WITH = [
  'React Native 0.81+',
  'New Architecture',
  'Expo development builds',
  'react-native-nitro-modules',
  'react-native-keyboard-controller',
  'react-native-safe-area-context',
];

const LANGUAGES = [
  'c',
  'css',
  'go',
  'html',
  'java',
  'javascript',
  'json',
  'kotlin',
  'markdown',
  'python',
  'rust',
  'swift',
  'tsx',
  'typescript',
  'yaml',
];

function Check() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M13.5 4.5 6.5 11.5 3 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => setCopied(false),
    );
  }
  return (
    <button
      type="button"
      className={styles.copy}
      onClick={copy}
      aria-label={copied ? 'Copied' : 'Copy the install command'}
    >
      {copied ? (
        <Check />
      ) : (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
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
      )}
    </button>
  );
}

function Buttons() {
  return (
    <div className={styles.buttons}>
      <Link className={styles.primary} to="/start/installation/">
        Read the docs
      </Link>
      <Link className={styles.quiet} href={REPO}>
        GitHub
      </Link>
    </div>
  );
}

function Hero() {
  return (
    <header className={styles.hero}>
      <h1 className={styles.headline}>A native code editor for React Native.</h1>
      <p className={styles.lead}>
        Its own engine on each platform, Kotlin on Android and Swift on iOS, with tree-sitter
        highlighting and a Nitro binding. No WebView.
      </p>
      <div className={styles.install}>
        <code>{INSTALL}</code>
        <CopyButton text={INSTALL} />
      </div>
      <Buttons />
    </header>
  );
}

function Section({
  title,
  lead,
  aside,
  children,
}: {
  title: string;
  lead?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const head = (
    <div className={styles.sectionHead}>
      <h2>{title}</h2>
      {lead && <p>{lead}</p>}
      {aside && children}
    </div>
  );
  if (aside) {
    return (
      <section className={styles.section}>
        <div className={styles.split}>
          {head}
          <div>{aside}</div>
        </div>
      </section>
    );
  }
  return (
    <section className={styles.section}>
      {head}
      {children}
    </section>
  );
}

function Chips({ items, to }: { items: string[]; to?: string }) {
  return (
    <ul className={styles.chips}>
      {items.map((item) => (
        <li key={item}>{to ? <Link to={to}>{item}</Link> : <span>{item}</span>}</li>
      ))}
    </ul>
  );
}

function Speed() {
  const [typing, parse, paint] = FIGURES;
  const work = Number.parseFloat(typing.value);
  return (
    <Section
      title="Keystrokes stay inside the frame."
      lead="The time to handle a key and draw the result, next to one frame at 60 Hz."
    >
      <div className={styles.bars}>
        <div className={styles.barRow}>
          <span className={styles.barLabel}>codepad</span>
          <span className={styles.bar} style={{ width: `${(work / FRAME_MS) * 100}%` }} />
          <span className={styles.barValue}>{typing.value}</span>
        </div>
        <div className={styles.barRow}>
          <span className={styles.barLabel}>one frame</span>
          <span className={clsx(styles.bar, styles.barFrame)} />
          <span className={styles.barValue}>{FRAME_MS} ms</span>
        </div>
      </div>
      <p className={styles.method}>
        {typing.value} {typing.label}, median over 60 keystrokes at 150 ms per key, {typing.where}.
      </p>
      <dl className={styles.figures}>
        {[parse, paint].map((figure) => (
          <div key={figure.value} className={styles.figure}>
            <dt>{figure.value}</dt>
            <dd>
              {figure.label}
              <small>{figure.where}</small>
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.method}>
        Simulator and emulator numbers, kept to catch regressions. Numbers from a real device are
        welcome in an issue.
      </p>
    </Section>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <main className={styles.page}>
        <Hero />
        <Speed />

        <Section
          title="Tree-sitter highlighting, one package per language."
          lead="Install a language package and pass its id. Your app carries only the languages it uses."
          aside={
            <div className={styles.codeCard}>
              <CodeBlock language="tsx">{highlight}</CodeBlock>
            </div>
          }
        >
          <Chips items={LANGUAGES} to="/reference/languages/" />
        </Section>

        <Section
          title="Everything the keyboard does, from JavaScript."
          lead="The soft keyboard, hardware keys and the ref all drive the same engine paths."
        >
          <ul className={styles.checklist}>
            {EDITING.map(([strong, rest]) => (
              <li key={strong}>
                <Check />
                <span>
                  <strong>{strong}</strong> {rest}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Follows the keyboard, frame by frame."
          lead="The editor insets itself by the keyboard's overlap and follows the keyboard animation frame by frame."
          aside={
            <div className={styles.codeCard}>
              <CodeBlock language="tsx">{keyboard}</CodeBlock>
            </div>
          }
        />

        <Section title="And it works with what you use.">
          <Chips items={WORKS_WITH} />
        </Section>

        <section className={clsx(styles.section, styles.cta)}>
          <h2>Start with the installation.</h2>
          <Buttons />
        </section>
      </main>
    </Layout>
  );
}
