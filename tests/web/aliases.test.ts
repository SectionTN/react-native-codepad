import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { canonicalInjectionId, INJECTION_ALIASES } from '../../src/web/aliases.ts';

const root = path.join(import.meta.dirname, '..', '..');

// The (name, id) pairs between start and the next line that closes it, in a native source file.
function table(file: string, start: string, close: string, pair: RegExp): Record<string, string> {
  const source = readFileSync(path.join(root, file), 'utf8');
  const from = source.indexOf(start);
  const body = source.slice(from, source.indexOf(close, from));
  const out: Record<string, string> = {};
  for (const [, name, id] of body.matchAll(pair)) out[name as string] = id as string;
  return out;
}

test('the web alias table matches Kotlin and Swift', () => {
  const kotlin = table(
    'android/src/main/java/me/sectiontn/codepad/syntax/LanguageRegistry.kt',
    'aliases = mapOf(',
    '\n  )',
    /"([^"]+)" to "([^"]*)"/g,
  );
  const swift = table(
    'ios/Codepad/syntax/LanguageRegistry.swift',
    'aliases: [String: String] = [',
    '\n  ]',
    /"([^"]+)": "([^"]*)"/g,
  );
  assert.ok(Object.keys(kotlin).length > 40);
  assert.deepEqual({ ...INJECTION_ALIASES }, kotlin);
  assert.deepEqual({ ...INJECTION_ALIASES }, swift);
});

test('an installed id wins over its alias and an empty alias never injects', () => {
  const installed = (id: string) => id === 'sql';
  assert.equal(canonicalInjectionId('JS', installed), 'javascript');
  assert.equal(canonicalInjectionId('sql', installed), 'sql');
  assert.equal(canonicalInjectionId('bash', installed), null);
  assert.equal(canonicalInjectionId('constructor', installed), 'constructor');
});
