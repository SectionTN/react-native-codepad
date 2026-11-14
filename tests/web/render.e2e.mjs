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
  // The core with the test hooks, from cpp/web/build.sh --test.
  copyWebAssets(
    path.join(root, 'example'),
    path.join(out, 'test'),
    path.join(root, 'build/web-test'),
  );
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
      // Chromium keeps its scrollbars, so a test can see the space they take as on Windows and Linux.
      browser = await engine.launch(
        engine === chromium ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {},
      );
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
        // html injects javascript and javascript injects html, and both start loading at once.
        const a = new EditorView(document.getElementById('a'), m, '<script>let x = 1;</script>\n');
        const b = new EditorView(document.getElementById('b'), m, 'let x = 1;\n');
        a.setLanguage('html');
        b.setLanguage('javascript');
        const colored = (id, word) => {
          const s = [...document.querySelectorAll(`#${id} [data-line="0"] span`)].find(
            (e) => e.textContent === word,
          );
          return s ? getComputedStyle(s).color : null;
        };
        await until(() => colored('a', 'let') && colored('b', 'let'));
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

    test('a destroyed view writes nothing into the editor opened after it', async () => {
      const { page, errors } = await open();
      const text = await page.evaluate(async () => {
        const { EditorView, loadCore, until } = window.codepad;
        const m = await loadCore();
        const a = new EditorView(document.getElementById('a'), m, 'first');
        await until(() => document.querySelector('#a [data-line="0"]'));
        a.destroy();
        const b = new EditorView(document.getElementById('b'), m, 'second');
        a.apply(() => a.core.replace(0, 0, 'ZZZ'));
        return b.core.text();
      });
      assert.equal(text, 'second');
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('unmounting during a parse closes the engine and keeps no snapshot', async () => {
      const { page, errors } = await open('test');
      const result = await page.evaluate(async () => {
        const { EditorView, ensureLanguage, frames, loadCore, until } = window.codepad;
        const m = await loadCore();
        await ensureLanguage(m, 'python');
        const host = document.getElementById('a');
        const text = Array.from({ length: 20000 }, (_, i) => `def f${i}(x):\n    return x + ${i}`);
        const view = new EditorView(host, m, text.join('\n'));
        view.setLanguage('python');
        await until(() => host.querySelector('[data-line="0"]'));
        view.destroy();
        for (let i = 0; i < 120 && m._cpw_test_slots() > 0; i++) await frames(1);
        await frames(2);
        return {
          slots: m._cpw_test_slots(),
          held: m._cpw_test_held_snapshots(),
          children: host.childElementCount,
        };
      });
      assert.deepEqual(result, { slots: 0, held: 0, children: 0 });
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('destroying the only editor on an idle page frees its engine', async () => {
      const { page, errors } = await open('test');
      const result = await page.evaluate(async () => {
        const { EditorView, frames, loadCore, until } = window.codepad;
        const m = await loadCore();
        const host = document.getElementById('a');
        const view = new EditorView(host, m, 'def f():\n    pass\n');
        view.setLanguage('python');
        await until(() => host.querySelector('[data-line="0"] span'));
        await frames(10);
        view.destroy();
        await frames(30);
        return { slots: m._cpw_test_slots(), held: m._cpw_test_held_snapshots() };
      });
      assert.deepEqual(result, { slots: 0, held: 0 });
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('wrapped lines stay left of a vertical scrollbar that takes space', async () => {
      const { page, errors } = await open();
      const result = await page.evaluate(async () => {
        const { EditorView, frames, loadCore, until } = window.codepad;
        const style = document.createElement('style');
        style.textContent =
          '#a [data-scroller]::-webkit-scrollbar { width: 16px; } #a [data-scroller]::-webkit-scrollbar-thumb { background: #888; }';
        document.head.append(style);
        const host = document.getElementById('a');
        const text = Array.from({ length: 60 }, () => 'word '.repeat(80)).join('\n');
        const view = new EditorView(host, await loadCore(), text);
        view.setOptions({ softWrap: true });
        const scroller = host.querySelector('[data-scroller]');
        await until(() => host.querySelector('[data-line="0"]'));
        await frames(5);
        const edge = scroller.getBoundingClientRect().left + scroller.clientWidth;
        const lines = [...host.querySelectorAll('[data-line]')];
        return {
          bar: scroller.offsetWidth - scroller.clientWidth,
          wrapped: lines[0].getBoundingClientRect().height > view.layout.rowHeight,
          over: lines.filter((el) => el.getBoundingClientRect().right > edge + 0.5).length,
        };
      });
      assert.ok(result.bar > 0, `no scrollbar space: ${result.bar}`);
      assert.equal(result.wrapped, true);
      assert.equal(result.over, 0);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('an editor that does not scroll reports no vertical scroll when the page scrolls', async () => {
      const { page, errors } = await open();
      const ys = await page.evaluate(async () => {
        const { EditorView, frames, loadCore, until } = window.codepad;
        const host = document.getElementById('c');
        const text = Array.from({ length: 300 }, (_, i) => `line ${i}`).join('\n');
        const ys = [];
        const view = new EditorView(host, await loadCore(), text);
        view.setOptions({ scrollEnabled: false, onScroll: (_x, y) => ys.push(y) });
        await until(() => host.querySelector('[data-line="0"]'));
        window.scrollTo(0, 2000);
        await frames(5);
        return ys;
      });
      assert.ok(
        ys.every((y) => y === 0),
        String(ys),
      );
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('a highlighted span after an emoji holds whole characters', async () => {
      const { page, errors } = await open();
      const texts = await page.evaluate(async () => {
        const { EditorView, loadCore, until } = window.codepad;
        const view = new EditorView(
          document.getElementById('a'),
          await loadCore(),
          'const s = "\u{1F600}"; let t = 1;',
        );
        view.setLanguage('javascript');
        const spans = () => [...document.querySelectorAll('#a [data-line="0"] span')];
        await until(() => spans().some((s) => s.textContent === 'let'));
        return spans().map((s) => s.textContent);
      });
      assert.ok(texts.includes('"\u{1F600}"'), JSON.stringify(texts));
      assert.ok(texts.includes('let'), JSON.stringify(texts));
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
