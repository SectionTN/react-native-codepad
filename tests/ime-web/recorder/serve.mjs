import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

// Serves the keyboard recorder on loopback and saves each recording it posts into tests/ime-web.
const here = import.meta.dirname;
const out = path.join(here, '..');
const NAME = /^[a-z0-9-]+$/;
const PAGES = { '/': 'index.html', '/recorder.js': 'recorder.js' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (req.method === 'POST' && pathname === '/save') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let recording = null;
    try {
      recording = JSON.parse(body);
    } catch {}
    if (typeof recording?.name !== 'string' || !NAME.test(recording.name)) {
      res.writeHead(400).end('the name takes lowercase letters, digits and dashes');
      return;
    }
    await writeFile(
      path.join(out, `${recording.name}.json`),
      `${JSON.stringify(recording, null, 2)}\n`,
    );
    res.writeHead(200).end('saved');
    return;
  }
  const file = PAGES[pathname];
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] });
  res.end(await readFile(path.join(here, file)));
});

server.listen(Number(process.argv[2] ?? 8090), '127.0.0.1', () => {
  console.log(`recorder on http://127.0.0.1:${server.address().port}/`);
});
