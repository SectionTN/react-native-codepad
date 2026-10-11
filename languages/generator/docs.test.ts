import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { languagesPage } from './docs.ts';

test('languagesPage lists every generated package with its grammar, scanner, injections and captures', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'codepad-docs-'));
  const pkg = path.join(dir, 'foo');
  mkdirSync(path.join(pkg, 'queries/foo'), { recursive: true });
  mkdirSync(path.join(pkg, 'grammar/src'), { recursive: true });
  writeFileSync(
    path.join(pkg, 'package.json'),
    JSON.stringify({
      name: 'react-native-codepad-lang-foo',
      codepad: { generated: true, grammar: 'org/tree-sitter-foo@abc' },
    }),
  );
  // The capture list drops private captures, dedupes and sorts.
  writeFileSync(
    path.join(pkg, 'queries/foo/highlights.scm'),
    '(a) @keyword\n((b) @_hidden @string.special)\n(c) @keyword\n',
  );
  writeFileSync(
    path.join(pkg, 'queries/foo/injections.scm'),
    '((c) @injection.content (#set! injection.language "bar"))\n(d (e) @injection.language (f) @injection.content)\n',
  );
  writeFileSync(path.join(pkg, 'grammar/src/scanner.c'), '');
  mkdirSync(path.join(dir, 'generator'));
  const text = languagesPage(dir);
  assert.ok(text.startsWith('---\ntitle: Language packages'), text.slice(0, 60));
  assert.ok(
    text.includes(
      '| react-native-codepad-lang-foo | `foo` | [org/tree-sitter-foo](https://github.com/org/tree-sitter-foo/tree/abc) | yes | bar, from the source |',
    ),
    text,
  );
  assert.ok(text.includes('### foo\n\n`keyword`, `string.special`'), text);
});
