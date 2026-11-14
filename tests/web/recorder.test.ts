import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.join(import.meta.dirname, '..', '..');
const dir = path.join(root, 'tests', 'ime-web');

// Starts the recorder on a free port and resolves its base URL from the line it prints.
function start(): Promise<{ url: string; stop: () => void }> {
  const child = spawn(process.execPath, [path.join(dir, 'recorder', 'serve.mjs'), '0'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`recorder exited with ${code}`)));
    child.stdout.on('data', (chunk: Buffer) => {
      const match = /http:\/\/127\.0\.0\.1:\d+\//.exec(chunk.toString());
      if (match) resolve({ url: match[0], stop: () => child.kill() });
    });
  });
}

const post = (url: string, body: unknown) =>
  fetch(`${url}save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('the recorder server writes only plain names inside tests/ime-web', async () => {
  const { url, stop } = await start();
  const written = path.join(dir, 'ok-name.json');
  try {
    const ok = await post(url, { name: 'ok-name', events: [] });
    assert.equal(ok.status, 200);
    assert.equal(JSON.parse(readFileSync(written, 'utf8')).name, 'ok-name');
    for (const name of ['../escape', 'a/b', 'Upper', '']) {
      const res = await post(url, { name, events: [] });
      assert.equal(res.status, 400, name);
    }
    assert.equal(existsSync(path.join(root, 'tests', 'escape.json')), false);
    assert.equal(existsSync(path.join(dir, 'a')), false);
  } finally {
    rmSync(written, { force: true });
    stop();
  }
});
