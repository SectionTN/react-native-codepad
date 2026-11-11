import { sample } from '../sample';
import { c } from './c';
import { css } from './css';
import { dtd } from './dtd';
import { go } from './go';
import { html } from './html';
import { ini } from './ini';
import { java } from './java';
import { json } from './json';
import { kotlin } from './kotlin';
import { kv_lite } from './kv_lite';
import { markdown } from './markdown';
import { php } from './php';
import { php_only } from './php_only';
import { python } from './python';
import { rust } from './rust';
import { sql } from './sql';
import { swift } from './swift';
import { tsx } from './tsx';
import { typescript } from './typescript';
import { xml } from './xml';
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
  'php',
  'php_only',
  'sql',
  'xml',
  'dtd',
  'ini',
  'kv_lite',
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
  php,
  php_only,
  sql,
  xml,
  dtd,
  ini,
  kv_lite,
};
