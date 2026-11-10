// Writes tests/highlight/<id>.txt from the example's samples, the sources the highlight goldens cover.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const samples = join(root, 'example/src/samples');
const out = join(root, 'tests/highlight');

const ids = [
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
  'kv_lite',
];

mkdirSync(out, { recursive: true });
const write = (id, text) => writeFileSync(join(out, `${id}.txt`), text);
write('javascript', (await import(pathToFileURL(join(root, 'example/src/sample.ts')).href)).sample);
for (const id of ids) {
  const text = (await import(pathToFileURL(join(samples, `${id}.ts`)).href))[id];
  if (typeof text !== 'string') throw new Error(`${id}.ts exports no ${id} string`);
  write(id, text);
}
console.log(`wrote ${ids.length + 1} sources to tests/highlight`);
