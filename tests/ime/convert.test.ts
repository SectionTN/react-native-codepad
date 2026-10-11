import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = join(import.meta.dirname, '../../scripts/ime-record-convert.mjs');
const prefix = '2026-10-10 18:00:00.000 Df CodepadExample[1:2] [me.sectiontn.codepad:ime] ';
const stream = [
  `${prefix}{"t":0,"call":"open","ime":"ja-JP","after":{"sel":[4,4],"marked":null,"len":4,"text":"x = "}}`,
  `${prefix}{"call":"paint","latency":12,"work":3}`,
  `${prefix}{"t":7,"call":"setMarkedText","args":["k",[1,0]],"after":{"sel":[5,5],"marked":[4,5],"len":5,"text":"x = k"}}`,
  `${prefix}{"t":9,"call":"unmarkText","args":[],"after":{"sel":[5,5],"marked":null,"len":5,"text":"x = k"}}`,
  '',
].join('\n');

function convert(args: string[]): string {
  return execFileSync('node', [script, ...args], { input: stream, encoding: 'utf8' });
}

test('iOS entries convert without inputType and keep the marked range', () => {
  const out = JSON.parse(convert(['kana', 'iPhone 18 Pro']));
  assert.equal(out.name, 'kana');
  assert.equal(out.ime, 'ja-JP');
  assert.equal(out.sessions.length, 1);
  const session = out.sessions[0];
  assert.equal('inputType' in session, false);
  assert.deepEqual(session.initial, { text: 'x = ', selection: [4, 4] });
  assert.deepEqual(
    session.steps.map((s: { call: string }) => s.call),
    ['setMarkedText', 'unmarkText'],
  );
  assert.deepEqual(session.steps[0].after, { sel: [5, 5], marked: [4, 5], len: 5, text: 'x = k' });
  assert.equal('ret' in session.steps[0], false);
  const dir = mkdtempSync(join(tmpdir(), 'codepad-ime-'));
  assert.match(convert(['kana', 'iPhone 18 Pro', dir]), /wrote .*kana\.json \(2 steps\)/);
  const written = JSON.parse(readFileSync(join(dir, 'kana.json'), 'utf8'));
  assert.equal(written.sessions[0].steps.length, 2);
});
