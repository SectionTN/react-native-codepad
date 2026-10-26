import { findAll } from './highlight';

export type Doc = { text: string; caret: number };

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"' };

// A small editor: closes pairs, skips a typed closer, expands a block on Enter, keeps the indent.
// '⌫' deletes backward and '↓' moves to the end of the next line.
export function press(doc: Doc, key: string): Doc {
  const { text: t, caret: c } = doc;
  const after = t[c];
  const before = t[c - 1];
  if (key === '⌫') {
    if (PAIRS[before] && PAIRS[before] === after)
      return { text: t.slice(0, c - 1) + t.slice(c + 1), caret: c - 1 };
    return { text: t.slice(0, c - 1) + t.slice(c), caret: c - 1 };
  }
  if (key === '↓') {
    const i = t.indexOf('\n', c);
    if (i < 0) return { text: t, caret: t.length };
    const j = t.indexOf('\n', i + 1);
    return { text: t, caret: j < 0 ? t.length : j };
  }
  if ((key === ')' || key === ']' || key === '}' || key === '"') && after === key)
    return { text: t, caret: c + 1 };
  if (PAIRS[key]) return { text: t.slice(0, c) + key + PAIRS[key] + t.slice(c), caret: c + 1 };
  if (key === '\n') {
    const start = t.lastIndexOf('\n', c - 1) + 1;
    const indent = /^ */.exec(t.slice(start, c))?.[0] ?? '';
    if (PAIRS[before] && before !== '"') {
      const inner = `${indent}  `;
      const tail = after === PAIRS[before] ? `\n${indent}` : '';
      return {
        text: `${t.slice(0, c)}\n${inner}${tail}${t.slice(c)}`,
        caret: c + 1 + inner.length,
      };
    }
    return { text: `${t.slice(0, c)}\n${indent}${t.slice(c)}`, caret: c + 1 + indent.length };
  }
  return { text: t.slice(0, c) + key + t.slice(c), caret: c + 1 };
}

export const HERO_SCRIPT =
  '// readFile with retries\nimport { readFile } from "node:fs/promises";\n\nexport async function load(path, retr⌫ries = 3) {\nfor (let i = 0; i < retries; i++) {\ntry {\nreturn await readFile(path, "utf8");↓ catch (error) {\nif (i === retries - 1) throw error;↓↓\nreturn null;↓';
export const KEYBOARD_KEYS = '\n\nload("config.json");';
export const QUERY = 'retries';
export const REPLACEMENT = 'attempts';

const typeAll = (doc: Doc, keys: string) => Array.from(keys).reduce(press, doc);

export const TYPED = typeAll({ text: '', caret: 0 }, HERO_SCRIPT);
const replacedText = TYPED.text.split(QUERY).join(REPLACEMENT);
export const REPLACED: Doc = { text: replacedText, caret: replacedText.length };
export const LOADED = typeAll(REPLACED, KEYBOARD_KEYS);

// The document each chapter opens on.
export const SNAPSHOTS: Doc[] = [{ text: '', caret: 0 }, TYPED, REPLACED, LOADED];

export const CAPTIONS = {
  type: '<CodeEditor autoCloseBrackets autoIndent />',
  search: "editor.setSearch({ text: 'retries' })",
  replace: "editor.replaceAll('attempts')",
  keyboard: '<CodeEditor avoidKeyboard />',
  theme: (name: string) => `<CodeEditor theme={${name}} />`,
};

export function replaceAll(doc: Doc, query: string, replacement: string) {
  const matches = findAll(doc.text, query);
  let text = '';
  let last = 0;
  let shift = 0;
  const flash: [number, number][] = [];
  for (const [a, b] of matches) {
    text += doc.text.slice(last, a) + replacement;
    flash.push([a + shift, a + shift + replacement.length]);
    shift += replacement.length - (b - a);
    last = b;
  }
  text += doc.text.slice(last);
  return { text, caret: text.length, flash, count: matches.length };
}

// Key delays in ms; the seeded generator keeps every loop identical.
export function keyDelays() {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const typing = Array.from(HERO_SCRIPT).map((k) =>
    k === '\n' ? 150 : k === '↓' ? 200 : k === '⌫' ? 180 : k === ' ' ? 26 : 22 + rnd() * 34,
  );
  const keyboard = Array.from(KEYBOARD_KEYS).map((k) => (k === '\n' ? 220 : 60 + rnd() * 50));
  return { typing, keyboard };
}
