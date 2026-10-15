import { generateJavaScript, generateMarkdown } from './bench/generate';
import { type LanguageId, SAMPLES } from './samples';

export type EditorFile = {
  id: string;
  name: string;
  language?: string;
  load: () => string;
};

export const LANGUAGE_NAMES: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  markdown: 'Markdown',
  python: 'Python',
  java: 'Java',
  kotlin: 'Kotlin',
  swift: 'Swift',
  c: 'C',
  rust: 'Rust',
  go: 'Go',
  yaml: 'YAML',
};

const SAMPLE_NAMES: [LanguageId, string][] = [
  ['javascript', 'sample.js'],
  ['typescript', 'types.ts'],
  ['tsx', 'App.tsx'],
  ['json', 'package.json'],
  ['html', 'index.html'],
  ['css', 'styles.css'],
  ['markdown', 'README.md'],
  ['python', 'main.py'],
  ['java', 'Main.java'],
  ['kotlin', 'Main.kt'],
  ['swift', 'main.swift'],
  ['c', 'main.c'],
  ['rust', 'main.rs'],
  ['go', 'main.go'],
  ['yaml', 'config.yaml'],
];

export const SAMPLE_FILES: EditorFile[] = SAMPLE_NAMES.map(([id, name]) => ({
  id,
  name,
  language: id,
  load: () => SAMPLES[id],
}));

// Generated on open, so the status bar's open time covers the same work as the benches.
export const GENERATED_FILES: EditorFile[] = [
  {
    id: 'js10k',
    name: '10k-lines.js',
    language: 'javascript',
    load: () => generateJavaScript(10_000),
  },
  {
    id: 'js100k',
    name: '100k-lines.js',
    language: 'javascript',
    load: () => generateJavaScript(100_000),
  },
  {
    id: 'md2k',
    name: '2k-paragraphs.md',
    language: 'markdown',
    load: () => generateMarkdown(2000),
  },
];

export const UNTITLED: EditorFile = { id: 'untitled', name: 'untitled', load: () => '' };

export const FILES: EditorFile[] = [...SAMPLE_FILES, ...GENERATED_FILES, UNTITLED];

export function fileById(id: string): EditorFile {
  return FILES.find((file) => file.id === id) ?? UNTITLED;
}
