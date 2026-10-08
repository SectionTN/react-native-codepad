const block = [
  '// readFile with retries',
  'import { readFile } from "node:fs/promises";',
  '',
  'const MAX_RETRIES = 3;',
  'const MESSAGE = "a long string literal that keeps going past the edge of the screen so soft wrap has something to do";',
  '',
  'export async function load(path, retries = MAX_RETRIES) {',
  '  for (let i = 0; i < retries; i++) {',
  '    try {',
  '      return await readFile(path, "utf8");',
  '    } catch (error) {',
  '      if (i === retries - 1) throw error;',
  '    }',
  '  }',
  '  return null;',
  '}',
  '',
].join('\n');

export const sample = new Array(40).fill(block).join('\n');
