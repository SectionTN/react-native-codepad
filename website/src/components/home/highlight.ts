import { Prism } from 'prism-react-renderer';
import { PRISM_CAPTURES } from '../../prism/fromEditorTheme';
import type { Capture } from './editorThemes';

// Editor captures that paint with the color of a broader one.
const FOLD: Record<string, Capture> = {
  'string.special': 'string',
  boolean: 'constant',
  'variable.member': 'property',
  module: 'type',
};

// Prism token types to editor captures: PRISM_CAPTURES reversed, plus Markdown's own types.
const FROM_PRISM = new Map<string, Capture>([
  ['title', 'heading'],
  ['bold', 'strong'],
  ['url', 'link'],
  ['code-snippet', 'string'],
  ['code', 'string'],
  ['list', 'muted'],
  ['blockquote', 'comment'],
]);
for (const [capture, types] of Object.entries(PRISM_CAPTURES)) {
  for (const type of types) FROM_PRISM.set(type, FOLD[capture] ?? (capture as Capture));
}

const GRAMMAR: Record<string, string> = { html: 'markup' };

type PrismToken = {
  type: string;
  alias?: string | string[];
  content: string | PrismToken | (string | PrismToken)[];
};
type Leaf = { text: string; capture: Capture };

function walk(tokens: (string | PrismToken)[], stack: string[][], out: Leaf[]) {
  for (const token of tokens) {
    if (typeof token === 'string') {
      out.push({ text: token, capture: captureOf(stack) });
      continue;
    }
    const names = [
      token.type,
      ...(token.alias === undefined ? [] : ([] as string[]).concat(token.alias)),
    ];
    walk(([] as (string | PrismToken)[]).concat(token.content), [...stack, names], out);
  }
}

// The innermost mapped type wins; a JSX component name inside a tag paints as the tag.
function captureOf(stack: string[][]): Capture {
  for (let i = stack.length - 1; i >= 0; i--) {
    for (const name of stack[i]) {
      if (name === 'class-name' && stack.some((names) => names.includes('tag'))) return 'tag';
      const capture = FROM_PRISM.get(name);
      if (capture) return capture;
    }
  }
  return 'variable';
}

function leavesOf(source: string, language: string): Leaf[] {
  const grammar = Prism.languages[GRAMMAR[language] ?? language];
  if (!grammar) return [{ text: source, capture: 'variable' }];
  const out: Leaf[] = [];
  walk(Prism.tokenize(source, grammar) as (string | PrismToken)[], [], out);
  return out;
}

// One capture per UTF-16 unit of the source.
export function capturesOf(source: string, language: string): Capture[] {
  return leavesOf(source, language).flatMap((leaf) =>
    Array<Capture>(leaf.text.length).fill(leaf.capture),
  );
}

// Token counts per capture, for the playground's legend.
export function countTokens(source: string, language: string): Partial<Record<Capture, number>> {
  const counts: Partial<Record<Capture, number>> = {};
  for (const { text, capture } of leavesOf(source, language)) {
    if (text.trim()) counts[capture] = (counts[capture] ?? 0) + 1;
  }
  return counts;
}

export type Paint = 'match' | 'active' | 'flash';
export type Segment = { text: string; capture: Capture; paint?: Paint } | { caret: true };
export type Line = Segment[];

type Marks = {
  caret?: number;
  matches?: [number, number][];
  active?: number;
  flash?: [number, number][] | null;
};

// Splits the source into lines of same-capture, same-paint runs, with the caret as its own segment.
export function linesOf(text: string, caps: Capture[], marks: Marks = {}): Line[] {
  const paintAt = (i: number): Paint | undefined => {
    const { matches, active, flash } = marks;
    if (matches) {
      for (let k = 0; k < matches.length; k++) {
        if (i >= matches[k][0] && i < matches[k][1]) return k === active ? 'active' : 'match';
      }
    }
    if (flash?.some(([a, b]) => i >= a && i < b)) return 'flash';
    return undefined;
  };
  const lines: Line[] = [];
  let line: Line = [];
  let run: { text: string; capture: Capture; paint?: Paint } | null = null;
  const flush = () => {
    if (run) line.push(run);
    run = null;
  };
  for (let i = 0; i <= text.length; i++) {
    if (marks.caret === i) {
      flush();
      line.push({ caret: true });
    }
    if (i === text.length) break;
    const ch = text[i];
    if (ch === '\n') {
      flush();
      lines.push(line);
      line = [];
      continue;
    }
    const capture = caps[i];
    const paint = paintAt(i);
    if (run && run.capture === capture && run.paint === paint) run.text += ch;
    else {
      flush();
      run = { text: ch, capture, paint };
    }
  }
  flush();
  lines.push(line);
  return lines;
}

export function findAll(text: string, query: string): [number, number][] {
  const out: [number, number][] = [];
  if (!query) return out;
  const hay = text.toLowerCase();
  const needle = query.toLowerCase();
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) {
    out.push([i, i + needle.length]);
  }
  return out;
}
