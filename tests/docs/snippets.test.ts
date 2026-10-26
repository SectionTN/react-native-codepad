import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIR = path.join(ROOT, 'website/src/snippets');

test('every landing snippet compiles against the public API', () => {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => path.join(DIR, f));
  assert.ok(files.length > 0, 'no snippets found');

  const configFile = path.join(ROOT, 'tsconfig.json');
  const { config } = ts.readConfigFile(configFile, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, ROOT);
  // The language packages are linked under example/, so the snippets resolve them by path.
  const paths = {
    ...parsed.options.paths,
    'react-native-codepad-lang-*': [path.join(ROOT, 'languages/*/src/index')],
  };
  const program = ts.createProgram(files, {
    ...parsed.options,
    paths,
    noEmit: true,
    skipLibCheck: true,
  });
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file && files.includes(d.file.fileName))
    .map((d) => {
      const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      if (!d.file || d.start === undefined) return message;
      const { line } = d.file.getLineAndCharacterOfPosition(d.start);
      return `${path.basename(d.file.fileName)}:${line + 1} ${message}`;
    });
  assert.deepEqual(diagnostics, []);
});
