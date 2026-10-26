import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import clsx from 'clsx';
import { SITE } from '../../data/site';
import styles from './AgentsTerminal.module.css';
import { FX } from './fx';
import { useCopy, useLoop } from './hooks';
import { Eyebrow } from './SectionHeader';
import ui from './ui.module.css';

const SKILL = 'npx skills add SectionTN/react-native-codepad';

export function AgentsTerminal() {
  const [copied, copy] = useCopy();
  const typed = useLoop<HTMLSpanElement>(FX.term);
  const caret = useLoop<HTMLSpanElement>(FX.termcaret);
  const llms = useBaseUrl('/llms-full.txt');
  return (
    <section className={ui.section}>
      <div className={styles.split}>
        <div data-reveal className={styles.copy}>
          <Eyebrow n="06" label="agents" />
          <h2 className={ui.h2}>Your coding agent already knows it.</h2>
          <p className={styles.lead}>
            The CodePad skill gives coding agents the API and its pitfalls. The whole docs also ship
            as one plain text file.
          </p>
          <div className={styles.chips}>
            {['Claude Code', 'Codex', 'Cursor'].map((agent) => (
              <span key={agent} className={styles.chip}>
                {agent}
              </span>
            ))}
          </div>
          <div className={styles.links}>
            <Link to="/guides/ai-agents/">AI coding agents guide →</Link>
            <a href={llms}>llms-full.txt →</a>
          </div>
        </div>
        <div data-reveal="80" className={styles.terminal}>
          <div className={styles.bar}>
            <span>terminal</span>
            <button
              type="button"
              className={styles.copyButton}
              onClick={() => copy('skill', SKILL)}
            >
              {copied === 'skill' ? 'Copied' : 'Copy'}
            </button>
          </div>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (axe scrollable-region-focusable) */}
          <div className={styles.body} tabIndex={0}>
            <div className={styles.command}>
              <span className={styles.prompt}>$</span>
              <span className={styles.relative}>
                <span ref={typed} className={styles.typed}>
                  {SKILL}
                </span>
                <span ref={caret} className={styles.caret} />
              </span>
            </div>
            <div className={styles.comment}># or hand it the docs as plain text</div>
            <div className={styles.command}>
              <span className={styles.prompt}>$</span>
              <span>
                curl <span className={clsx(styles.url)}>{SITE}/llms-full.txt</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
