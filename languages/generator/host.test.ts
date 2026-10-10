import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { hostGrammarNames, hostHeader, writeHostHeader } from './host.ts';
import { languagesDir } from './manifest.ts';

test('hostHeader declares every grammar under languages once, sorted', () => {
  const names = hostGrammarNames(languagesDir);
  assert.equal(names.length, 16);
  assert.ok(names.includes('markdown_inline'));
  assert.deepEqual(names, [...names].sort());
  const text = hostHeader(names);
  assert.ok(text.startsWith('#ifndef CODEPAD_HOST_GRAMMARS_H\n#define CODEPAD_HOST_GRAMMARS_H\n'));
  assert.ok(text.includes('const void *tree_sitter_javascript(void);\n'));
  assert.equal(text.match(/tree_sitter_/g)?.length, 16);
  assert.equal(hostHeader([...names].reverse()), text);
});

test('writeHostHeader rewrites the header only when its content changes', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'codepad-host-'));
  const src = path.join(dir, 'foo/grammar/src');
  mkdirSync(src, { recursive: true });
  writeFileSync(path.join(src, 'parser.c'), 'const TSLanguage *tree_sitter_foo(void) {\n}\n');
  mkdirSync(path.join(dir, '.cache/bar/grammar/src'), { recursive: true });
  writeFileSync(
    path.join(dir, '.cache/bar/grammar/src/parser.c'),
    'const TSLanguage *tree_sitter_bar(void) {\n}\n',
  );
  const file = path.join(dir, 'host/include/host_grammars.h');
  writeHostHeader(dir);
  const text = readFileSync(file, 'utf8');
  assert.equal(text, hostHeader(['foo']));
  const written = statSync(file).mtimeMs;
  writeHostHeader(dir);
  assert.equal(statSync(file).mtimeMs, written);
});
