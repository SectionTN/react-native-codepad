import { sample } from '../sample';
import { c } from './c';
import { css } from './css';
import { go } from './go';
import { html } from './html';
import { java } from './java';
import { json } from './json';
import { kotlin } from './kotlin';
import { markdown } from './markdown';
import { python } from './python';
import { rust } from './rust';
import { swift } from './swift';
import { tsx } from './tsx';
import { typescript } from './typescript';
import { yaml } from './yaml';

export const LANGUAGES = [
  'javascript',
  'typescript',
  'tsx',
  'json',
  'html',
  'css',
  'markdown',
  'python',
  'java',
  'kotlin',
  'swift',
  'c',
  'rust',
  'go',
  'yaml',
] as const;

export type LanguageId = (typeof LANGUAGES)[number];

export const SAMPLES: Record<LanguageId, string> = {
  javascript: sample,
  typescript,
  tsx,
  json,
  html,
  css,
  markdown,
  python,
  java,
  kotlin,
  swift,
  c,
  rust,
  go,
  yaml,
};
