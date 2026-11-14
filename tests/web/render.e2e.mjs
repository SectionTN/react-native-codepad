// The read-only web editor in Chromium and WebKit: yarn prepare, yarn build:web, yarn build:web-grammars first.
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { chromium, webkit } from 'playwright';
import { copyWebAssets } from '../../lib/cli/web-assets.js';

const root = path.join(import.meta.dirname, '..', '..');
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
};
const KEYWORD = 'rgb(207, 34, 46)';

let server;
let base;

before(async () => {
  const out = path.join(root, 'build/web-e2e');
  rmSync(out, { recursive: true, force: true });
  copyWebAssets(path.join(root, 'example'), path.join(out, 'ok'));
  copyWebAssets(path.join(root, 'example'), path.join(out, 'missing'));
  rmSync(path.join(out, 'missing/codepad/python.wasm'));
  server = createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    try {
      const body = readFileSync(file);
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

for (const engine of [chromium, webkit]) {
  describe(engine.name(), () => {
    let browser;
    before(async () => {
      browser = await engine.launch();
    });
    after(() => browser.close());

    async function open(assets = 'ok') {
      const page = await browser.newPage();
      page.setDefaultTimeout(10000);
      const warnings = [];
      const errors = [];
      page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(
        `${base}/tests/web/harness/index.html?assets=/build/web-e2e/${assets}/codepad/`,
      );
      await page.waitForFunction(() => window.ready === true);
      return { page, warnings, errors };
    }

    test('colors python keywords', async () => {
      const { page, errors } = await open();
      const color = await page.evaluate(async () => {
        const { EditorView, loadCore, until } = window.codepad;
        const view = new EditorView(
          document.getElementById('a'),
          await loadCore(),
          'def greet(name):\n    return name\n',
        );
        view.setLanguage('python');
        const span = () =>
          [...document.querySelectorAll('#a [data-line="0"] span')].find(
            (s) => s.textContent === 'def',
          );
        await until(() => span());
        return getComputedStyle(span()).color;
      });
      assert.equal(color, KEYWORD);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test("two editors keep separate languages and one survives the other's unmount", async () => {
      const { page, errors } = await open();
      const result = await page.evaluate(async () => {
        const { EditorView, loadCore, until } = window.codepad;
        const m = await loadCore();
        const a = new EditorView(document.getElementById('a'), m, 'def f():\n    pass\n');
        const b = new EditorView(document.getElementById('b'), m, 'let x = 1;\n');
        a.setLanguage('python');
        b.setLanguage('javascript');
        const colored = (id, word) => {
          const s = [...document.querySelectorAll(`#${id} [data-line="0"] span`)].find(
            (e) => e.textContent === word,
          );
          return s ? getComputedStyle(s).color : null;
        };
        await until(() => colored('a', 'def') && colored('b', 'let'));
        a.destroy();
        b.apply(() => b.core.replace(0, 0, 'const y = 2;\n'));
        await until(() => colored('b', 'const'));
        return {
          emptied: document.getElementById('a').childElementCount,
          b: colored('b', 'const'),
        };
      });
      assert.equal(result.emptied, 0);
      assert.equal(result.b, KEYWORD);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('caret x grows across an emoji and Arabic', async () => {
      const { page, errors } = await open();
      const result = await page.evaluate(async () => {
        const { EditorView, loadCore, until } = window.codepad;
        const view = new EditorView(
          document.getElementById('a'),
          await loadCore(),
          'a\u{1F600}ب c',
        );
        await until(() => document.querySelector('#a [data-line="0"]'));
        const xs = [0, 1, 3, 4, 5, 6].map((offset) => view.caretRect(offset)?.x ?? null);
        const nodes = [...document.querySelectorAll('#a [data-line="0"] span, #a [data-line="0"]')];
        const split = nodes.some((n) =>
          [...n.childNodes].some(
            (c) => c.nodeType === 3 && /^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(c.data),
          ),
        );
        return { xs, split };
      });
      assert.ok(
        result.xs.every((x) => typeof x === 'number'),
        String(result.xs),
      );
      for (let i = 1; i < result.xs.length; i++)
        assert.ok(result.xs[i] > result.xs[i - 1], String(result.xs));
      assert.equal(result.split, false);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('content height without scrolling', async () => {
      const { page, errors } = await open();
      const result = await page.evaluate(async () => {
        const { EditorView, loadCore, until } = window.codepad;
        const host = document.getElementById('c');
        const text = Array.from({ length: 300 }, (_, i) => `line ${i}`).join('\n');
        const sizes = [];
        const view = new EditorView(host, await loadCore(), text);
        view.setOptions({ scrollEnabled: false, onContentSize: (_w, h) => sizes.push(h) });
        await until(() => sizes.length > 0);
        const first = sizes[sizes.length - 1];
        const content = view.layout.contentHeight;
        const tall = host.getBoundingClientRect().height;
        const scroller = host.querySelector('[data-scroller]');
        const inner = scroller.scrollHeight - scroller.clientHeight;
        view.apply(() => view.core.replace(0, 0, 'new\n'));
        await until(() => sizes[sizes.length - 1] !== first);
        return {
          first,
          content,
          tall,
          inner,
          next: sizes[sizes.length - 1],
          row: view.layout.rowHeight,
        };
      });
      assert.equal(result.first, result.content);
      assert.equal(result.tall, result.first);
      assert.equal(result.inner, 0);
      assert.equal(result.next, result.first + result.row);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('a missing grammar draws plain text', async () => {
      const { page, warnings, errors } = await open('missing');
      const result = await page.evaluate(async () => {
        const { EditorView, loadCore, until } = window.codepad;
        const view = new EditorView(
          document.getElementById('a'),
          await loadCore(),
          'def f():\n    pass\n',
        );
        view.setLanguage('python');
        await until(() => document.querySelector('#a [data-line="0"]')?.textContent === 'def f():');
        await new Promise((r) => setTimeout(r, 300));
        return document.querySelectorAll('#a [data-line] span').length;
      });
      assert.equal(result, 0);
      assert.equal(warnings.length, 1, String(warnings));
      assert.match(warnings[0], /\/build\/web-e2e\/missing\/codepad\/python\.wasm/);
      assert.deepEqual(errors, []);
      await page.close();
    });
  });
}
