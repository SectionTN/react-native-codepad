import { usePrismTheme } from '@docusaurus/theme-common';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { Highlight } from 'prism-react-renderer';
import styles from './EditorMock.module.css';

// What the hero shows: a document the editor is working on, not the library's own API.
const SOURCE = `export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait = 250,
) {
  let timer: number | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const save = debounce(persistDraft, 400);
`;

const SEARCH = 'timer';
const ACTIVE_LINE = 7;
const ACTIVE_MATCH = 1;
const SELECTED = { line: 3, word: 'wait' };

type EditorColors = {
  activeLine: string;
  gutterForeground: string;
  gutterActiveForeground: string;
  selection: string;
  cursor: string;
  searchMatch: string;
  searchMatchActive: string;
};

type Piece = { text: string; word?: string };

// Prism folds identifiers into plain text with their neighbors; split the words we paint back out.
function split(content: string, words: string[]): Piece[] {
  const pieces: Piece[] = [];
  const pattern = new RegExp(`\\b(${words.join('|')})\\b`, 'g');
  let last = 0;
  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) pieces.push({ text: content.slice(last, index) });
    pieces.push({ text: match[0], word: match[0] });
    last = index + match[0].length;
  }
  if (last < content.length) pieces.push({ text: content.slice(last) });
  return pieces;
}

export function EditorMock() {
  const theme = usePrismTheme();
  const { siteConfig } = useDocusaurusContext();
  const palettes = siteConfig.customFields?.editorTheme as {
    light: EditorColors;
    dark: EditorColors;
  };
  const colors = theme.plain.backgroundColor === '#0d1117' ? palettes.dark : palettes.light;
  let matchIndex = -1;

  return (
    <div
      className={styles.editor}
      style={{ color: theme.plain.color }}
      role="img"
      aria-label="The editor with a search for timer open and the word wait selected"
    >
      <div className={styles.toolbar}>
        <span className={styles.search}>
          <span className={styles.searchQuery}>{SEARCH}</span>
          <span className={styles.searchCount} style={{ color: colors.gutterForeground }}>
            2 of 3
          </span>
        </span>
      </div>
      <Highlight code={SOURCE.trimEnd()} language="tsx" theme={theme}>
        {({ tokens, getTokenProps }) => (
          <div className={styles.lines}>
            {tokens.map((line, lineIndex) => {
              const number = lineIndex + 1;
              const active = number === ACTIVE_LINE;
              let column = 0;
              return (
                <div
                  key={number}
                  className={styles.line}
                  style={active ? { background: colors.activeLine } : undefined}
                >
                  <span
                    className={styles.gutter}
                    style={{
                      color: active ? colors.gutterActiveForeground : colors.gutterForeground,
                    }}
                  >
                    {number}
                  </span>
                  <span className={styles.code}>
                    {line.flatMap((token) => {
                      const props = getTokenProps({ token });
                      return split(token.content, [SEARCH, SELECTED.word]).map((piece) => {
                        const start = column;
                        column += piece.text.length;
                        const isMatch = piece.word === SEARCH;
                        if (isMatch) matchIndex += 1;
                        const isSelected = piece.word === SELECTED.word && number === SELECTED.line;
                        let paint = {};
                        if (isSelected) paint = { background: colors.selection };
                        else if (isMatch) {
                          paint = {
                            background:
                              matchIndex === ACTIVE_MATCH
                                ? colors.searchMatchActive
                                : colors.searchMatch,
                          };
                        }
                        return (
                          <span
                            key={start}
                            className={isSelected ? styles.selected : props.className}
                            style={{ ...props.style, ...paint }}
                          >
                            {piece.text}
                          </span>
                        );
                      });
                    })}
                    {active && (
                      <span className={styles.caret} style={{ background: colors.cursor }} />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Highlight>
    </div>
  );
}
