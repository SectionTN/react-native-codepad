import editing from '!!raw-loader!../snippets/editing.tsx';
import highlight from '!!raw-loader!../snippets/highlight.tsx';
import keyboard from '!!raw-loader!../snippets/keyboard.tsx';
import search from '!!raw-loader!../snippets/search.tsx';
import themes from '!!raw-loader!../snippets/themes.tsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import clsx from 'clsx';
import { useState } from 'react';
import { Feature } from '../components/Feature';
import { PhoneFrame } from '../components/PhoneFrame';
import styles from './index.module.css';

const INSTALL = 'npm install react-native-codepad react-native-nitro-modules';

const CARDS = [
  {
    title: 'Native engine',
    body: 'The document, layout, selection, undo and input live in Kotlin and Swift on the platform text APIs. The view draws its own caret, handles and edit menu.',
  },
  {
    title: 'Tree-sitter highlighting',
    body: 'Incremental parsing on a background thread, one language per npm package, fifteen at launch. Fenced blocks, embedded script and tagged templates highlight through injections.',
  },
  {
    title: 'Keyboard first',
    body: 'Soft keyboards with composition, hardware keys with the full key table, and a toolbar API that drives the same paths from JavaScript.',
  },
];

const FIGURES = [
  { value: '3 ms', label: 'of work per keystroke on a 10,000 line file' },
  { value: '7 ms', label: 'to reparse a 2,000 line Markdown file with 2,238 fenced blocks' },
  { value: '100k lines', label: 'scrolled with 3 janky frames out of 2,760' },
];

const WORKS_WITH = [
  'React Native 0.81+',
  'New Architecture',
  'Expo development builds',
  'react-native-nitro-modules',
  'react-native-keyboard-controller',
  'react-native-safe-area-context',
  'tree-sitter',
  'nvim-treesitter queries',
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

function InstallLine() {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(INSTALL).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => setCopied(false),
    );
  }
  return (
    <div className={styles.install}>
      <code>{INSTALL}</code>
      <button type="button" onClick={copy} aria-label="Copy the install command">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Hero() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <h1 className={styles.headline}>A native code editor for React Native.</h1>
        <p className={styles.tagline}>
          Kotlin and Swift engines, tree-sitter highlighting, a Nitro binding and no WebView.
        </p>
        <InstallLine />
        <div className={styles.buttons}>
          <Link className={clsx('button button--lg', styles.primary)} to="/start/installation/">
            Get started
          </Link>
          <Link
            className={clsx('button button--lg', styles.secondary)}
            href="https://github.com/SectionTN/react-native-codepad"
          >
            GitHub
          </Link>
        </div>
      </div>
      <div className={styles.phones}>
        <PhoneFrame platform="ios" />
        <PhoneFrame platform="android" className={styles.secondPhone} />
      </div>
    </header>
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

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <main className={styles.page}>
        <Hero />

        <section className={styles.cards}>
          {CARDS.map((card) => (
            <div key={card.title} className={styles.card}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </section>

        <Feature title="Highlighting" href="/guides/languages/" code={highlight}>
          Install a language package and pass its id. The grammar's parser and the nvim-treesitter
          queries ship in the package, so an app carries only the languages it uses.
        </Feature>
        <Feature title="Editing from JavaScript" href="/reference/methods/" code={editing} flip>
          The ref drives the same paths the keyboard does: type, move the caret, delete, undo. A
          toolbar is a row of buttons calling them.
        </Feature>
        <Feature title="Search" href="/guides/search/" code={search}>
          Literal or regex, case and whole word, next and previous with wrap around, replace one or
          all. Matches are painted while you type.
        </Feature>
        <Feature title="Keyboard" href="/guides/keyboard/" code={keyboard} flip>
          The editor insets itself by the keyboard's overlap and follows the keyboard animation
          frame by frame. Suggestions and autocorrect are a prop.
        </Feature>
        <Feature title="Themes" href="/guides/themes/" code={themes}>
          Three bundled themes and a token model that ports from nvim-treesitter captures. Spread
          one and override the tokens you want.
        </Feature>

        <section className={styles.figures}>
          <div className={styles.figureGrid}>
            {FIGURES.map((figure) => (
              <div key={figure.value} className={styles.figure}>
                <strong>{figure.value}</strong>
                <span>{figure.label}</span>
              </div>
            ))}
          </div>
          <p className={styles.caption}>
            p50 over 60 keystrokes at 150 ms, the first two on the iPhone 18 Pro simulator and the
            Pixel 9a emulator, the scroll on the Pixel 9a emulator, debugOptimized build. Simulator
            and emulator numbers track regressions; device numbers come with 0.1.0.
          </p>
        </section>

        <section className={styles.strip}>
          <h2>Works with</h2>
          <Chips items={WORKS_WITH} />
        </section>

        <section className={styles.strip}>
          <h2>Fifteen languages at launch</h2>
          <Chips items={LANGUAGES} to="/reference/languages/" />
        </section>
      </main>
    </Layout>
  );
}
