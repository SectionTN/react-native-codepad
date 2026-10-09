import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { captureNames } from '../../languages/generator/captures.ts';
import { githubDark } from '../../src/themes/githubDark.ts';
import { githubLight } from '../../src/themes/githubLight.ts';
import { oneDark } from '../../src/themes/oneDark.ts';
import type { Theme } from '../../src/types.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
// nvim reads spell and conceal as editor hints and none clears a style; none of them carries a color.
const SKIP = new Set(['spell', 'nospell', 'conceal', 'none']);
const THEMES: [string, Theme][] = [
  ['githubLight', githubLight],
  ['githubDark', githubDark],
  ['oneDark', oneDark],
];

// The same longest dotted prefix walk ThemeColors uses on Android.
function resolves(theme: Theme, name: string): boolean {
  let n = name;
  for (;;) {
    if (Object.hasOwn(theme.tokens, n)) return true;
    const dot = n.lastIndexOf('.');
    if (dot < 0) return false;
    n = n.slice(0, dot);
  }
}

function packageCaptures(): string[] {
  const names = new Set<string>();
  const languages = path.join(ROOT, 'languages');
  for (const id of readdirSync(languages)) {
    if (id === 'generator' || id.startsWith('.')) continue;
    const queries = path.join(languages, id, 'queries');
    if (!existsSync(queries)) continue;
    for (const grammar of readdirSync(queries)) {
      const file = path.join(queries, grammar, 'highlights.scm');
      if (!existsSync(file)) continue;
      for (const n of captureNames(readFileSync(file, 'utf8'))) names.add(n);
    }
  }
  return [...names].sort();
}

test('every capture of every package resolves in every shipped theme', () => {
  const names = packageCaptures().filter((n) => !SKIP.has(n));
  assert.ok(names.length > 60);
  for (const [label, theme] of THEMES) {
    const missing = names.filter((n) => !resolves(theme, n));
    assert.deepEqual(missing, [], `${label} misses ${missing.join(', ')}`);
  }
});

test('the three themes define the same token keys', () => {
  const keys = THEMES.map(([, t]) => Object.keys(t.tokens).sort());
  assert.deepEqual(keys[1], keys[0]);
  assert.deepEqual(keys[2], keys[0]);
});
