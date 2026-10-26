import { githubDark } from '../../../../src/themes/githubDark';
import { githubLight } from '../../../../src/themes/githubLight';
import { oneDark } from '../../../../src/themes/oneDark';
import type { Theme, TokenStyle } from '../../../../src/types';

export const CAPTURES = [
  'comment',
  'keyword',
  'string',
  'number',
  'constant',
  'function',
  'type',
  'property',
  'tag',
  'attribute',
  'punctuation',
  'operator',
  'variable',
  'heading',
  'strong',
  'link',
  'muted',
] as const;
export type Capture = (typeof CAPTURES)[number];
export type EditorThemeKey = 'githubDark' | 'oneDark' | 'githubLight';

// The theme token each painted capture reads, most specific first.
const SOURCE: Record<Capture, string[]> = {
  comment: ['comment'],
  keyword: ['keyword'],
  string: ['string'],
  number: ['number'],
  constant: ['constant'],
  function: ['function'],
  type: ['type'],
  property: ['property', 'variable.member'],
  tag: ['tag'],
  attribute: ['attribute', 'tag.attribute'],
  punctuation: ['punctuation'],
  operator: ['operator'],
  variable: ['variable'],
  heading: ['markup.heading'],
  strong: ['markup.strong'],
  link: ['markup.link'],
  muted: ['markup.list'],
};

type Chrome = Record<'kb' | 'key' | 'keyInk' | 'btn' | 'ink' | 'sub' | 'pill' | 'chrome', string>;

// Device chrome around the editor (keyboard, buttons, bars), which an editor theme does not carry.
const CHROME: Record<EditorThemeKey, Chrome> = {
  githubDark: {
    kb: '#1c1f24',
    key: '#3b4048',
    keyInk: '#e6edf3',
    btn: '#21262d',
    ink: '#e6edf3',
    sub: '#8b949e',
    pill: 'rgba(22,27,34,0.82)',
    chrome: '#161b22',
  },
  oneDark: {
    kb: '#21252b',
    key: '#3e4451',
    keyInk: '#d7dae0',
    btn: '#323842',
    ink: '#d7dae0',
    sub: '#7f848e',
    pill: 'rgba(33,37,43,0.85)',
    chrome: '#21252b',
  },
  githubLight: {
    kb: '#d3d6dc',
    key: '#ffffff',
    keyInk: '#1f2328',
    btn: '#eef1f4',
    ink: '#1f2328',
    sub: '#656d76',
    pill: 'rgba(246,248,250,0.9)',
    chrome: '#f6f8fa',
  },
};

export const EDITOR_THEMES: Record<EditorThemeKey, { label: string; theme: Theme }> = {
  githubDark: { label: 'GitHub Dark', theme: githubDark },
  oneDark: { label: 'One Dark', theme: oneDark },
  githubLight: { label: 'GitHub Light', theme: githubLight },
};

const colorOf = (token: TokenStyle | undefined) =>
  token === undefined ? undefined : typeof token === 'string' ? token : token.color;

export function captureColor(theme: Theme, capture: Capture): string {
  for (const name of SOURCE[capture]) {
    const color = colorOf(theme.tokens[name]);
    if (color) return color;
  }
  return theme.foreground;
}

// The --e-* variables a themed editor surface reads.
export function editorVars(key: EditorThemeKey): Record<string, string> {
  const t = EDITOR_THEMES[key].theme;
  const vars: Record<string, string> = {
    '--e-bg': t.background,
    '--e-fg': t.foreground,
    '--e-gutter': t.gutterForeground,
    '--e-gutterActive': t.gutterActiveForeground,
    '--e-activeLine': t.activeLine,
    '--e-selection': t.selection,
    '--e-cursor': t.cursor,
    '--e-searchMatch': t.searchMatch,
    '--e-searchActive': t.searchMatchActive,
  };
  for (const capture of CAPTURES) vars[`--e-${capture}`] = captureColor(t, capture);
  for (const [name, value] of Object.entries(CHROME[key])) vars[`--e-${name}`] = value;
  return vars;
}

const declarations = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');

// An editor without an explicit theme follows the site: githubDark in dark, githubLight in light.
export const SITE_THEME_CSS = `html[data-theme="dark"] [data-etheme="site"]{${declarations(editorVars('githubDark'))}}html[data-theme="light"] [data-etheme="site"]{${declarations(editorVars('githubLight'))}}`;
