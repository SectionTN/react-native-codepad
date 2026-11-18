// The read-only web editor in Chromium and WebKit: yarn prepare, yarn build:web, cpp/web/build.sh --test and
// yarn build:web-grammars first.
import assert from 'node:assert/strict';
import { readFileSync, realpathSync, rmSync } from 'node:fs';
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
// The folders the harness page loads from: itself, the built modules and the copied assets.
const SERVED = ['tests/web/harness', 'lib', 'build/web-e2e'].map(
  (dir) => path.join(realpathSync(root), dir) + path.sep,
);

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
    const file = path.resolve(
      root,
      `.${decodeURIComponent(new URL(req.url, 'http://x').pathname)}`,
    );
    try {
      // The real path, so a symlink cannot lead out of the served folders.
      const real = realpathSync(file);
      if (!SERVED.some((dir) => real.startsWith(dir))) throw new Error('not served');
      const body = readFileSync(real);
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
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

    // An editor on host id, kept as window.views[id], with its text drawn.
    async function editor(page, id, text, options = {}) {
      await page.evaluate(
        async ([id, text, options]) => {
          const { EditorView, loadCore, until } = window.codepad;
          const view = new EditorView(document.getElementById(id), await loadCore(), text);
          view.setOptions(options);
          window.views = { ...window.views, [id]: view };
          await until(() => document.querySelector(`#${id} [data-line="0"]`));
        },
        [id, text, options],
      );
    }

    // Clicks the left edge of a column in a drawn line.
    async function clickAt(page, id, line, column) {
      await page.waitForSelector(`#${id} [data-line="${line}"]`, { state: 'attached' });
      const { x, y } = await page.evaluate(
        ([id, line, column]) => {
          const el = document.querySelector(`#${id} [data-line="${line}"]`);
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let at = 0;
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (column <= at + node.data.length) {
              const range = document.createRange();
              range.setStart(node, column - at);
              range.setEnd(node, column - at);
              const r = range.getBoundingClientRect();
              return { x: r.left + 1, y: r.top + r.height / 2 };
            }
            at += node.data.length;
          }
          const r = el.getBoundingClientRect();
          return { x: r.right + 4, y: r.top + r.height / 2 };
        },
        [id, line, column],
      );
      await page.mouse.click(x, y);
    }

    const textOf = (page, id) => page.evaluate((id) => window.views[id].core.text(), id);
    const visible = (page, selector) =>
      page.evaluate((s) => {
        const el = document.querySelector(s);
        return !!el && el.style.display !== 'none' && el.getBoundingClientRect().width > 0;
      }, selector);

    // Starts a composition of text at the caret: the browser's own IME in Chromium, dispatched events in WebKit.
    async function compose(page, id, text) {
      if (engine === chromium) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.imeSetComposition', {
          text,
          selectionStart: text.length,
          selectionEnd: text.length,
        });
        return cdp;
      }
      await page.evaluate(
        ([id, text]) => {
          const ta = document.querySelector(`#${id} textarea`);
          const at = ta.selectionStart;
          ta.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
          ta.value = ta.value.slice(0, at) + text + ta.value.slice(at);
          ta.setSelectionRange(at + text.length, at + text.length);
          ta.dispatchEvent(
            new InputEvent('input', {
              inputType: 'insertCompositionText',
              data: text,
              isComposing: true,
            }),
          );
        },
        [id, text],
      );
      return null;
    }

    async function commit(page, id, cdp, composed, text) {
      if (cdp) return cdp.send('Input.insertText', { text });
      await page.evaluate(
        ([id, composed, text]) => {
          const ta = document.querySelector(`#${id} textarea`);
          const end = ta.selectionStart;
          ta.value = ta.value.slice(0, end - composed.length) + text + ta.value.slice(end);
          const at = end - composed.length + text.length;
          ta.setSelectionRange(at, at);
          ta.dispatchEvent(
            new InputEvent('input', {
              inputType: 'insertCompositionText',
              data: text,
              isComposing: true,
            }),
          );
          ta.dispatchEvent(new CompositionEvent('compositionend', { data: text }));
        },
        [id, composed, text],
      );
    }

    test('a click places the caret and typing inserts there', async () => {
      const { page, errors } = await open();
      await editor(page, 'a', 'abcdef\nghijkl\n');
      await clickAt(page, 'a', 1, 3);
      await page.keyboard.type('xy');
      assert.equal(await textOf(page, 'a'), 'abcdef\nghixyjkl\n');
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('Enter splits the line and Backspace joins it again', async () => {
      const { page } = await open();
      await editor(page, 'a', 'ab', { autoIndent: false });
      await clickAt(page, 'a', 0, 1);
      await page.keyboard.press('Enter');
      assert.equal(await textOf(page, 'a'), 'a\nb');
      await page.keyboard.press('Backspace');
      assert.equal(await textOf(page, 'a'), 'ab');
      await page.close();
    });

    test('a composition shows its underline then commits', async () => {
      const { page, errors } = await open();
      await editor(page, 'a', 'ab');
      await clickAt(page, 'a', 0, 2);
      const cdp = await compose(page, 'a', 'か');
      await page.waitForFunction(() => window.views.a.core.text() === 'abか');
      await page.evaluate(() => window.codepad.frames(2));
      assert.equal(await visible(page, '#a [data-composing]'), true);
      await commit(page, 'a', cdp, 'か', '蚊');
      await page.waitForFunction(() => window.views.a.core.text() === 'ab蚊');
      await page.evaluate(() => window.codepad.frames(2));
      assert.equal(await visible(page, '#a [data-composing]'), false);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('clicking elsewhere mid-composition leaves no underline', async () => {
      const { page } = await open();
      await editor(page, 'a', 'ab\ncd');
      await clickAt(page, 'a', 0, 2);
      await compose(page, 'a', 'か');
      await page.waitForFunction(() => window.views.a.core.text() === 'abか\ncd');
      await clickAt(page, 'a', 1, 1);
      await page.evaluate(() => window.codepad.frames(2));
      assert.equal(await visible(page, '#a [data-composing]'), false);
      assert.equal(await textOf(page, 'a'), 'abか\ncd');
      await page.close();
    });

    test('readOnly keeps the text and still places the caret', async () => {
      const { page } = await open();
      await editor(page, 'a', 'abc', { readOnly: true });
      await clickAt(page, 'a', 0, 1);
      await page.keyboard.type('x');
      assert.equal(await textOf(page, 'a'), 'abc');
      assert.equal(await page.evaluate(() => window.views.a.core.selection.head), 1);
      await page.close();
    });

    test('an onChange that throws keeps the edit and the sync', async () => {
      const { page, errors } = await open();
      await editor(page, 'a', '');
      await page.evaluate(() =>
        window.views.a.setOptions({
          onChange: () => {
            throw new Error('boom');
          },
        }),
      );
      await clickAt(page, 'a', 0, 0);
      await page.keyboard.type('ab');
      assert.equal(await textOf(page, 'a'), 'ab');
      assert.equal(await page.evaluate(() => document.querySelector('#a textarea').value), 'ab');
      assert.ok(
        errors.some((e) => /boom/.test(e)),
        String(errors),
      );
      await page.close();
    });

    test('only the focused editor draws a caret and takes keys', async () => {
      const { page } = await open();
      await editor(page, 'a', 'one');
      await editor(page, 'b', 'two');
      await clickAt(page, 'a', 0, 3);
      await clickAt(page, 'b', 0, 3);
      await page.keyboard.type('z');
      assert.equal(await textOf(page, 'b'), 'twoz');
      assert.equal(await textOf(page, 'a'), 'one');
      await page.evaluate(() => window.codepad.frames(2));
      assert.equal(await visible(page, '#a [data-caret]'), false);
      assert.equal(await visible(page, '#b [data-caret]'), true);
      await page.close();
    });

    test('onFocus and onBlur fire once per change', async () => {
      const { page } = await open();
      await editor(page, 'a', 'one');
      await editor(page, 'b', 'two');
      await page.evaluate(() => {
        window.counts = { focus: 0, blur: 0 };
        window.views.a.setOptions({
          onFocus: () => window.counts.focus++,
          onBlur: () => window.counts.blur++,
        });
      });
      await clickAt(page, 'a', 0, 1);
      await clickAt(page, 'a', 0, 2);
      await clickAt(page, 'b', 0, 1);
      assert.deepEqual(await page.evaluate(() => window.counts), { focus: 1, blur: 1 });
      await page.close();
    });

    test('select all then Backspace empties a file longer than the textarea window', async () => {
      const { page } = await open();
      await editor(
        page,
        'a',
        Array.from({ length: 3000 }, (_, i) => `line number ${i}`).join('\n'),
      );
      await clickAt(page, 'a', 0, 0);
      await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+a`);
      await page.evaluate(() => window.codepad.frames(3));
      await page.keyboard.press('Backspace');
      assert.equal(await textOf(page, 'a'), '');
      await page.close();
    });

    test('copy and cut after select all carry the whole document', async () => {
      const { page } = await open();
      const text = Array.from({ length: 3000 }, (_, i) => `line number ${i}`).join('\n');
      await editor(page, 'a', text);
      await clickAt(page, 'a', 0, 0);
      await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+a`);
      const result = await page.evaluate(async () => {
        await window.codepad.frames(2);
        const ta = document.querySelector('#a textarea');
        const clip = (type) => {
          const data = new DataTransfer();
          ta.dispatchEvent(
            new ClipboardEvent(type, { clipboardData: data, bubbles: true, cancelable: true }),
          );
          return data.getData('text/plain').length;
        };
        const copied = clip('copy');
        const cut = clip('cut');
        return { copied, cut, left: window.views.a.core.length };
      });
      assert.deepEqual(result, { copied: text.length, cut: text.length, left: 0 });
      await page.close();
    });

    test('a click on a line number keeps the focus where it is', async () => {
      const { page } = await open();
      await editor(page, 'a', 'one\ntwo');
      await page.evaluate(() => {
        window.counts = { focus: 0, blur: 0 };
        window.views.a.setOptions({
          onFocus: () => window.counts.focus++,
          onBlur: () => window.counts.blur++,
        });
      });
      await clickAt(page, 'a', 0, 1);
      const { x, y } = await page.evaluate(() => {
        const host = document.getElementById('a').getBoundingClientRect();
        const line = document.querySelector('#a [data-line="1"]').getBoundingClientRect();
        return { x: host.left + 4, y: line.top + line.height / 2 };
      });
      await page.mouse.click(x, y);
      assert.deepEqual(await page.evaluate(() => window.counts), { focus: 1, blur: 0 });
      await page.close();
    });

    test('typing after replaceRange, setText and undo lands at the core caret', async () => {
      const { page } = await open();
      await editor(page, 'a', 'abc');
      await clickAt(page, 'a', 0, 3);
      for (const step of [
        (v) => v.apply(() => v.core.replace(0, 0, 'Q')),
        (v) => v.apply(() => v.core.setText('new')),
        (v) => v.apply(() => v.core.undo()),
      ]) {
        await page.evaluate(`(${step})(window.views.a)`);
        const head = await page.evaluate(() => window.views.a.core.selection.head);
        const before = await textOf(page, 'a');
        await page.keyboard.type('z');
        assert.equal(await textOf(page, 'a'), `${before.slice(0, head)}z${before.slice(head)}`);
      }
      await page.close();
    });

    const head = (page) => page.evaluate(() => window.views.a.core.selection.head);

    test('ArrowDown keeps the column across a shorter line', async () => {
      const { page, errors } = await open();
      await editor(page, 'a', 'abcdef\nab\nabcdef');
      await clickAt(page, 'a', 0, 5);
      await page.keyboard.press('ArrowDown');
      assert.equal(await head(page), 9);
      await page.keyboard.press('ArrowDown');
      assert.equal(await head(page), 15);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('ArrowDown on the last visible row scrolls and moves', async () => {
      const { page } = await open();
      await editor(page, 'a', Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n'));
      await clickAt(page, 'a', 0, 2);
      const rows = await page.evaluate(() => {
        const v = window.views.a;
        return Math.ceil(v.layout.viewportHeight / v.layout.rowHeight);
      });
      for (let i = 0; i < rows + 3; i++) await page.keyboard.press('ArrowDown');
      const result = await page.evaluate(async () => {
        const v = window.views.a;
        await window.codepad.frames(2);
        const caret = v.caretRect(v.core.selection.head);
        return { line: v.core.lineAt(v.core.selection.head), y: caret?.y ?? null };
      });
      assert.equal(result.line, rows + 3);
      assert.ok(result.y !== null && result.y >= 0 && result.y < 300, `caret y ${result.y}`);
      await page.close();
    });

    test('Enter on the last visible row keeps the caret in view', async () => {
      const { page } = await open();
      await editor(page, 'a', Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n'));
      const last = await page.evaluate(() => {
        const v = window.views.a;
        return Math.floor(v.layout.viewportHeight / v.layout.rowHeight) - 1;
      });
      await clickAt(page, 'a', last, 6);
      for (let i = 0; i < 3; i++) await page.keyboard.press('Enter');
      const y = await page.evaluate(async () => {
        const v = window.views.a;
        await window.codepad.frames(2);
        return v.caretRect(v.core.selection.head)?.y ?? null;
      });
      assert.ok(y !== null && y >= 0 && y < 300, `caret y ${y}`);
      await page.close();
    });

    test("a typed letter keeps its line's element", async () => {
      const { page } = await open();
      await page.evaluate(() => window.codepad.ensureLanguage('python'));
      await editor(page, 'a', 'def a():\n    return b\n');
      await page.evaluate(async () => {
        window.views.a.setLanguage('python');
        await window.codepad.until(() => window.views.a.core.snapshot !== 0);
      });
      await clickAt(page, 'a', 1, 12);
      await page.evaluate(() => {
        window.kept = document.querySelector('#a [data-line="1"]');
      });
      await page.keyboard.type('x');
      const same = await page.evaluate(async () => {
        const v = window.views.a;
        await window.codepad.until(() => v.core.snapshot !== 0 && v.core.revision > 0);
        await window.codepad.frames(3);
        return document.querySelector('#a [data-line="1"]') === window.kept;
      });
      assert.equal(await textOf(page, 'a'), 'def a():\n    return bx\n');
      assert.equal(same, true);
      await page.close();
    });

    test('typing past the right edge keeps the caret in view without soft wrap', async () => {
      const { page } = await open();
      await editor(page, 'a', 'x');
      await clickAt(page, 'a', 0, 1);
      await page.keyboard.type('a'.repeat(90));
      const { x, width, textarea } = await page.evaluate(async () => {
        const v = window.views.a;
        await window.codepad.frames(2);
        const caret = v.caretRect(v.core.selection.head);
        return {
          x: caret?.x ?? -1,
          width: document.getElementById('a').clientWidth,
          textarea: Number.parseFloat(document.querySelector('#a textarea').style.left),
        };
      });
      assert.ok(x >= 0 && x <= width, `caret x ${x} of ${width}`);
      // The keyboard's candidate window opens at the textarea.
      assert.ok(Math.abs(textarea - x) <= 1, `textarea at ${textarea}, caret at ${x}`);
      await page.close();
    });

    // The box of a line element and the underline bars, relative to the editor's root.
    const boxes = (page, id, selector) =>
      page.evaluate(
        async ([id, selector]) => {
          await window.codepad.frames(2);
          const root = document.getElementById(id).firstElementChild.getBoundingClientRect();
          return [...document.querySelectorAll(`#${id} ${selector}`)].map((el) => {
            const r = el.getBoundingClientRect();
            return {
              top: r.top - root.top,
              bottom: r.bottom - root.top,
              left: r.left - root.left,
              right: r.right - root.left,
            };
          });
        },
        [id, selector],
      );

    test('a solid underline sits under its range, one bar per wrapped row', async () => {
      const { page } = await open();
      await editor(page, 'a', `${'word '.repeat(60)}\nnext`, { softWrap: true });
      await page.evaluate(() =>
        window.views.a.setDecorations(
          [{ kind: 'underline', range: { start: 10, end: 200 }, color: 'red' }],
          -1,
        ),
      );
      const bars = await boxes(page, 'a', '[data-underline]');
      const [line] = await boxes(page, 'a', '[data-line="0"]');
      const row = await page.evaluate(() => window.views.a.layout.rowHeight);
      assert.ok(bars.length >= 2, `${bars.length} bars`);
      for (const b of bars) {
        assert.ok(b.top > line.top && b.bottom <= line.bottom + 1, JSON.stringify({ b, line }));
        assert.ok(
          b.left >= line.left - 1 && b.right <= line.right + 1,
          JSON.stringify({ b, line }),
        );
        assert.equal(Math.round(b.top - bars[0].top) % row, 0);
      }
      await page.close();
    });

    test('a wavy underline draws one path per row clipped to its range', async () => {
      const { page } = await open();
      await editor(page, 'a', 'let total = 1');
      await page.evaluate(() =>
        window.views.a.setDecorations(
          [{ kind: 'underline', range: { start: 4, end: 9 }, color: 'blue', style: 'wavy' }],
          -1,
        ),
      );
      const [wave] = await boxes(page, 'a', 'svg[data-underline]');
      const width = await page.evaluate(() => {
        const el = document.querySelector('#a [data-line="0"]');
        const range = document.createRange();
        range.setStart(el.firstChild, 4);
        range.setEnd(el.firstChild, 9);
        return range.getBoundingClientRect().width;
      });
      assert.ok(wave, 'no wave');
      assert.ok(
        Math.abs(wave.right - wave.left - width) <= 1,
        `${wave.right - wave.left} for ${width}`,
      );
      assert.equal(
        await page.evaluate(() => document.querySelectorAll('#a svg[data-underline] path').length),
        1,
      );
      await page.close();
    });

    test('an underline across the whole document splits only the drawn lines on a key', async () => {
      const { page } = await open();
      await editor(page, 'a', 'x\n'.repeat(100_000));
      const calls = await page.evaluate(async () => {
        const v = window.views.a;
        const range = { start: 0, end: v.core.length };
        v.setDecorations([{ kind: 'underline', range, color: '#0000ff' }], v.core.revision);
        await window.codepad.frames(2);
        let n = 0;
        const lineStart = v.core.lineStart;
        v.core.lineStart = function (line) {
          n++;
          return lineStart.call(this, line);
        };
        v.apply(() => v.core.insertText('y', 'api'));
        await window.codepad.frames(2);
        delete v.core.lineStart;
        return n;
      });
      assert.ok(calls < 5000, `lineStart calls ${calls}`);
      await page.close();
    });

    test('a line background keeps its element and grows when a key widens the text', async () => {
      const { page } = await open();
      await editor(page, 'a', 'ab\ncd');
      const kept = await page.evaluate(async () => {
        const v = window.views.a;
        v.setDecorations([{ kind: 'lineBackground', line: 1, color: '#ff0000' }], v.core.revision);
        await window.codepad.frames(2);
        const before = document.querySelector('#a [data-line-background]');
        const width = before.getBoundingClientRect().width;
        v.apply(() => v.core.replace(2, 2, 'x'.repeat(200)));
        await window.codepad.frames(2);
        const after = document.querySelector('#a [data-line-background]');
        return [after === before, after.getBoundingClientRect().width > width];
      });
      assert.deepEqual(kept, [true, true]);
      await page.close();
    });

    test('a line background tints every row of its line above the active line', async () => {
      const { page } = await open();
      await editor(page, 'a', `one\n${'word '.repeat(60)}\nthree`, { softWrap: true });
      await page.evaluate(() =>
        window.views.a.setDecorations(
          [{ kind: 'lineBackground', line: 1, color: 'rgb(255, 0, 0)' }],
          -1,
        ),
      );
      const [bg] = await boxes(page, 'a', '[data-line-background]');
      const [line] = await boxes(page, 'a', '[data-line="1"]');
      assert.ok(
        Math.abs(bg.top - line.top) <= 1 && Math.abs(bg.bottom - line.bottom) <= 1,
        JSON.stringify({ bg, line }),
      );
      const above = await page.evaluate(() => {
        const active = document.querySelector('#a [data-active-line]');
        const tint = document.querySelector('#a [data-line-background]');
        return !!(active.compareDocumentPosition(tint) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      assert.equal(above, true);
      await page.close();
    });

    test('a gap pushes the next line down by rows times the row height and onGapLayout reports it', async () => {
      const { page } = await open();
      await editor(page, 'a', 'a\nb\nc');
      await page.evaluate(() => {
        window.gapsSeen = [];
        window.views.a.setOptions({ onGapLayout: (gaps) => window.gapsSeen.push(gaps) });
        window.views.a.setDecorations([{ kind: 'gap', line: 0, rows: 2 }], -1);
      });
      const [first] = await boxes(page, 'a', '[data-line="0"]');
      const [second] = await boxes(page, 'a', '[data-line="1"]');
      const row = await page.evaluate(() => window.views.a.layout.rowHeight);
      assert.ok(
        Math.abs(second.top - first.top - 3 * row) <= 1,
        `${second.top - first.top} for ${3 * row}`,
      );
      const last = await page.evaluate(() => window.gapsSeen.at(-1));
      assert.equal(last.length, 1);
      assert.equal(last[0].line, 0);
      assert.ok(Math.abs(last[0].rect.y - (first.top + row)) <= 1, JSON.stringify(last[0]));
      assert.equal(last[0].rect.height, 2 * row);
      assert.equal(last[0].rect.x, 0);
      await page.close();
    });

    test('a gap scrolled into view fires onGapLayout again', async () => {
      const { page } = await open();
      await editor(page, 'a', Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n'));
      const before = await page.evaluate(async () => {
        window.gapsSeen = [];
        window.views.a.setOptions({ onGapLayout: (gaps) => window.gapsSeen.push(gaps) });
        window.views.a.setDecorations([{ kind: 'gap', line: 150, rows: 2 }], -1);
        await window.codepad.frames(2);
        return { count: window.gapsSeen.length, y: window.gapsSeen.at(-1)[0].rect.y };
      });
      const after = await page.evaluate(async () => {
        window.views.a.scrollToLine(140);
        await window.codepad.frames(3);
        return { count: window.gapsSeen.length, y: window.gapsSeen.at(-1)[0].rect.y };
      });
      assert.ok(after.count > before.count, JSON.stringify({ before, after }));
      assert.ok(after.y < before.y, JSON.stringify({ before, after }));
      await page.close();
    });

    test('getGapRect is null for a line with no gap', async () => {
      const { page } = await open();
      await editor(page, 'a', 'a\nb\nc');
      const rects = await page.evaluate(async () => {
        window.views.a.setDecorations([{ kind: 'gap', line: 0, rows: 1 }], -1);
        await window.codepad.frames(2);
        return [window.views.a.gapRect(0), window.views.a.gapRect(1)];
      });
      assert.notEqual(rects[0], null);
      assert.equal(rects[1], null);
      await page.close();
    });

    test('a gap under the last line grows the content height', async () => {
      const { page } = await open();
      await editor(page, 'a', 'a\nb');
      const grew = await page.evaluate(async () => {
        const v = window.views.a;
        await window.codepad.frames(1);
        const before = v.layout.contentHeight;
        v.setDecorations([{ kind: 'gap', line: 1, rows: 3 }], -1);
        await window.codepad.frames(2);
        return { before, after: v.layout.contentHeight, row: v.layout.rowHeight };
      });
      assert.equal(grew.after - grew.before, 3 * grew.row);
      await page.close();
    });

    test('a click inside a gap leaves the caret where it was', async () => {
      const { page } = await open();
      await editor(page, 'a', 'abc\ndef');
      await page.evaluate(async () => {
        const v = window.views.a;
        v.setDecorations([{ kind: 'gap', line: 0, rows: 3 }], -1);
        v.apply(() => v.core.setSelection(1, 1));
        await window.codepad.frames(2);
      });
      const [first] = await boxes(page, 'a', '[data-line="0"]');
      const row = await page.evaluate(() => window.views.a.layout.rowHeight);
      const root = await page.evaluate(() => {
        const r = document.getElementById('a').firstElementChild.getBoundingClientRect();
        return { left: r.left, top: r.top };
      });
      await page.mouse.click(root.left + first.left + 10, root.top + first.top + 2.5 * row);
      assert.equal(await page.evaluate(() => window.views.a.core.selection.head), 1);
      await page.close();
    });

    test('decorations made for an older revision follow the edits since', async () => {
      const { page } = await open();
      await editor(page, 'a', 'hello world');
      const range = await page.evaluate(() => {
        const v = window.views.a;
        const old = v.core.revision;
        v.apply(() => v.core.replace(0, 0, 'XX'));
        v.setDecorations([{ kind: 'underline', range: { start: 6, end: 11 }, color: 'red' }], old);
        return v.core.decorations()[0].range;
      });
      assert.deepEqual(range, { start: 8, end: 13 });
      await page.close();
    });

    test('decorations for a revision more than 256 edits back keep the current set', async () => {
      const { page } = await open();
      await editor(page, 'a', 'hello');
      const kept = await page.evaluate(() => {
        const v = window.views.a;
        const old = v.core.revision;
        v.setDecorations([{ kind: 'lineBackground', line: 0, color: 'red' }], -1);
        for (let i = 0; i < 300; i++) v.apply(() => v.core.replace(0, 0, 'x'));
        v.setDecorations([{ kind: 'gap', line: 0, rows: 2 }], old);
        return v.core.decorations().map((d) => d.kind);
      });
      assert.deepEqual(kept, ['lineBackground']);
      await page.close();
    });

    test('matches paint under the text and the one equal to the selection in the active color', async () => {
      const { page } = await open();
      await editor(page, 'a', 'ab ab ab');
      const painted = await page.evaluate(async () => {
        const v = window.views.a;
        await v.setSearch({ text: 'ab' });
        await v.findNext();
        await window.codepad.frames(2);
        return {
          all: document.querySelectorAll('#a [data-match]').length,
          active: document.querySelectorAll('#a [data-match-active]').length,
        };
      });
      assert.deepEqual(painted, { all: 3, active: 1 });
      await page.close();
    });

    test('setSearch resolves the count and limited', async () => {
      const { page } = await open();
      await editor(page, 'a', 'ab ab ab');
      const result = await page.evaluate(() => window.views.a.setSearch({ text: 'ab' }));
      assert.deepEqual(result, { count: 3, limited: false });
      await page.close();
    });

    test('setSearch with a bad regex rejects with the message, clears the painted matches, and findNext then resolves null', async () => {
      const { page } = await open();
      await editor(page, 'a', 'ab ab ab');
      const out = await page.evaluate(async () => {
        const v = window.views.a;
        await v.setSearch({ text: 'ab' });
        let message = '';
        try {
          await v.setSearch({ text: '(', regex: true });
        } catch (e) {
          message = e.message;
        }
        await window.codepad.frames(2);
        return {
          message,
          painted: document.querySelectorAll('#a [data-match]').length,
          hit: await v.findNext(),
        };
      });
      assert.ok(out.message.length > 0, 'no message');
      assert.equal(out.painted, 0);
      assert.equal(out.hit, null);
      await page.close();
    });

    test('findNext after an edit waits for fresh matches and selects one in the new text', async () => {
      const { page } = await open();
      await editor(page, 'a', 'x ab');
      const out = await page.evaluate(async () => {
        const v = window.views.a;
        await v.setSearch({ text: 'ab' });
        v.apply(() => v.core.replace(0, 0, 'ab '));
        v.apply(() => v.core.setSelection(0, 0));
        const hit = await v.findNext();
        return { hit, selection: v.core.selection };
      });
      assert.deepEqual(out.hit, { index: 0, total: 2 });
      assert.deepEqual(out.selection, { anchor: 0, head: 2 });
      await page.close();
    });

    test('replaceAll is one undo step and resolves with the count', async () => {
      const { page } = await open();
      await editor(page, 'a', 'ab ab ab');
      const out = await page.evaluate(async () => {
        const v = window.views.a;
        await v.setSearch({ text: 'ab' });
        const n = await v.replaceAll('X');
        const after = v.core.text();
        v.apply(() => v.core.undo());
        return { n, after, undone: v.core.text() };
      });
      assert.deepEqual(out, { n: 3, after: 'X X X', undone: 'ab ab ab' });
      await page.close();
    });

    test('replaceCurrent is false when the selection is not a match', async () => {
      const { page } = await open();
      await editor(page, 'a', 'ab ab');
      const replaced = await page.evaluate(async () => {
        const v = window.views.a;
        await v.setSearch({ text: 'ab' });
        return v.replaceCurrent('X');
      });
      assert.equal(replaced, false);
      assert.equal(await textOf(page, 'a'), 'ab ab');
      await page.close();
    });

    test('clearSearch removes the painted matches', async () => {
      const { page } = await open();
      await editor(page, 'a', 'ab ab');
      const painted = await page.evaluate(async () => {
        const v = window.views.a;
        await v.setSearch({ text: 'ab' });
        await window.codepad.frames(2);
        const before = document.querySelectorAll('#a [data-match]').length;
        await v.clearSearch();
        await window.codepad.frames(2);
        return [before, document.querySelectorAll('#a [data-match]').length];
      });
      assert.deepEqual(painted, [2, 0]);
      await page.close();
    });

    test('frames keep landing while another editor scans a long text', async () => {
      const { page } = await open();
      await editor(page, 'a', 'one');
      await editor(page, 'b', Array.from({ length: 20000 }, () => 'word '.repeat(20)).join('\n'));
      const out = await page.evaluate(async () => {
        let frames = 0;
        let longest = 0;
        let last = performance.now();
        let counting = true;
        const tick = (t) => {
          frames++;
          longest = Math.max(longest, t - last);
          last = t;
          if (counting) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const result = await window.views.b.setSearch({ text: '\\w+', regex: true });
        counting = false;
        return { frames, longest, count: result.count };
      });
      assert.equal(out.count, 400000);
      assert.ok(out.frames >= 5, JSON.stringify(out));
      assert.ok(out.longest < 100, JSON.stringify(out));
      await page.close();
    });

    test('matchBrackets draws the pair next to the caret and nothing when off', async () => {
      const { page } = await open();
      await editor(page, 'a', '(a [b] c)');
      const counts = await page.evaluate(async () => {
        const v = window.views.a;
        v.apply(() => v.core.setSelection(1, 1));
        await window.codepad.frames(2);
        const on = document.querySelectorAll('#a [data-bracket]').length;
        v.setOptions({ matchBrackets: false });
        await window.codepad.frames(2);
        return [on, document.querySelectorAll('#a [data-bracket]').length];
      });
      assert.deepEqual(counts, [2, 0]);
      await page.close();
    });

    test('a bracket inside a string has no pair once the snapshot is in', async () => {
      const { page } = await open();
      await page.evaluate(() => window.codepad.ensureLanguage('python'));
      await editor(page, 'a', 'x = "(" + y)');
      const count = await page.evaluate(async () => {
        const v = window.views.a;
        v.setLanguage('python');
        await window.codepad.until(() => v.core.snapshot !== 0);
        v.apply(() => v.core.setSelection(6, 6));
        await window.codepad.frames(3);
        return document.querySelectorAll('#a [data-bracket]').length;
      });
      assert.equal(count, 0);
      await page.close();
    });

    test('matches, the bracket pair and underlines follow the text when the gutter, a gap, the font size, the top inset or the theme changes', async () => {
      const { page } = await open();
      await editor(page, 'a', 'x\n(ab) ab', { lineNumbers: false });
      const drift = await page.evaluate(async () => {
        const v = window.views.a;
        const { frames, githubLight } = window.codepad;
        // The page box of the text from column start to end on line 1.
        const textBox = (start, end) => {
          const node = document.querySelector('#a [data-line="1"]');
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          const range = document.createRange();
          let at = 0;
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (start >= at && start <= at + n.data.length) range.setStart(n, start - at);
            if (end >= at && end <= at + n.data.length) range.setEnd(n, end - at);
            at += n.data.length;
          }
          return range.getBoundingClientRect();
        };
        const off = () => {
          const match = document.querySelector('#a [data-match]').getBoundingClientRect();
          const bracket = document.querySelector('#a [data-bracket]').getBoundingClientRect();
          const line = document.querySelector('#a [data-underline]').getBoundingClientRect();
          const ab = textBox(1, 3);
          const open = textBox(0, 1);
          const under = textBox(5, 7);
          return Math.max(
            Math.abs(match.left - ab.left),
            Math.abs(match.top - ab.top),
            Math.abs(match.width - ab.width),
            Math.abs(bracket.left - open.left),
            Math.abs(bracket.top - open.top),
            Math.abs(bracket.height - open.height),
            Math.abs(line.left - under.left),
            Math.abs(line.width - under.width),
            line.top > under.bottom + 8 || line.top < under.top ? 99 : 0,
          );
        };
        const underline = { kind: 'underline', range: { start: 7, end: 9 }, color: '#0000ff' };
        v.setDecorations([underline], v.core.revision);
        await v.setSearch({ text: 'ab' });
        v.apply(() => v.core.setSelection(3, 3));
        await frames(2);
        const before = off();
        v.setOptions({ lineNumbers: true });
        await frames(2);
        const gutter = off();
        v.setDecorations([underline, { kind: 'gap', line: 0, rows: 2 }], v.core.revision);
        await frames(2);
        const gap = off();
        v.setOptions({ fontSize: 22 });
        await frames(2);
        const font = off();
        const textTop = textBox(1, 3).top;
        v.setOptions({ contentInsets: { top: 30 } });
        await frames(2);
        const inset = off();
        const moved = textBox(1, 3).top - textTop;
        v.setOptions({ theme: { ...githubLight, searchMatch: '#ff0000' } });
        await frames(2);
        const color = getComputedStyle(document.querySelector('#a [data-match]')).backgroundColor;
        return { before, gutter, gap, font, inset, moved, color };
      });
      assert.ok(drift.before < 1, `before ${drift.before}`);
      assert.ok(drift.gutter < 1, `after the gutter ${drift.gutter}`);
      assert.ok(drift.gap < 1, `after the gap ${drift.gap}`);
      assert.ok(drift.font < 1, `after the font size ${drift.font}`);
      assert.equal(Math.round(drift.moved), 30);
      assert.ok(drift.inset < 1, `after the top inset ${drift.inset}`);
      assert.equal(drift.color, 'rgb(255, 0, 0)');
      await page.close();
    });

    // Every 'ab' on the drawn lines of host a has a match mark on it and the second 'ab' of a line an underline, and no mark sits anywhere else.
    async function marksOnText(page) {
      return page.evaluate(() => {
        const marks = (s) =>
          [...document.querySelectorAll(`#a ${s}`)].map((m) => m.getBoundingClientRect());
        const matches = marks('[data-match]');
        const unders = marks('[data-underline]');
        let missing = 0;
        let wantMatches = 0;
        let wantUnders = 0;
        for (const el of document.querySelectorAll('#a [data-line]')) {
          const text = el.textContent;
          let nth = 0;
          for (let col = text.indexOf('ab'); col >= 0; col = text.indexOf('ab', col + 2), nth++) {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const range = document.createRange();
            let at = 0;
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              if (col >= at && col <= at + n.data.length) range.setStart(n, col - at);
              if (col + 2 >= at && col + 2 <= at + n.data.length) range.setEnd(n, col + 2 - at);
              at += n.data.length;
            }
            const r = range.getBoundingClientRect();
            wantMatches++;
            if (!matches.some((m) => Math.abs(m.left - r.left) < 1 && Math.abs(m.top - r.top) < 1))
              missing++;
            if (nth !== 1) continue;
            wantUnders++;
            const under = (u) =>
              Math.abs(u.left - r.left) < 1 && u.top >= r.top && u.top < r.bottom + 8;
            if (!unders.some(under)) missing++;
          }
        }
        return {
          missing,
          extraMatches: matches.length - wantMatches,
          extraUnders: unders.length - wantUnders,
        };
      });
    }
    const ON_TEXT = { missing: 0, extraMatches: 0, extraUnders: 0 };

    // Lines of 'ab ab' indented by 0 to 3 spaces, so a mark left on another row misses its text, the second 'ab' underlined, and a search for 'ab'.
    async function markEveryLine(page, lines) {
      const rows = Array.from({ length: lines }, (_, i) => `${' '.repeat(i % 4)}ab ab`);
      await editor(page, 'a', rows.join('\n'));
      await page.evaluate(async (rows) => {
        const v = window.views.a;
        const items = [];
        let start = 0;
        for (const row of rows) {
          const at = start + row.lastIndexOf('ab');
          items.push({ kind: 'underline', range: { start: at, end: at + 2 }, color: '#00f' });
          start += row.length + 1;
        }
        v.setDecorations(items, v.core.revision);
        await v.setSearch({ text: 'ab' });
        await window.codepad.frames(2);
      }, rows);
    }

    test('a typed letter keeps the match and underline marks of the other lines', async () => {
      const { page } = await open();
      await markEveryLine(page, 6);
      const kept = await page.evaluate(async () => {
        const v = window.views.a;
        const all = () => [...document.querySelectorAll('#a [data-match], #a [data-underline]')];
        const before = all();
        for (const m of before) m.__kept = true;
        const at = v.core.lineStart(2);
        v.apply(() => v.core.replace(at, at, 'x'));
        await window.codepad.frames(3);
        return [before.length, all().filter((m) => m.__kept).length];
      });
      assert.deepEqual(kept, [18, 15]);
      assert.deepEqual(await marksOnText(page), ON_TEXT);
      await page.close();
    });

    test('marks sit on their text in the frame after an Enter above, a gap and a scroll out and back', async () => {
      const { page } = await open();
      await markEveryLine(page, 40);
      assert.deepEqual(await marksOnText(page), ON_TEXT);
      await page.evaluate(() => {
        const v = window.views.a;
        v.apply(() => v.core.replace(0, 0, '\n'));
        v.draw();
      });
      assert.deepEqual(await marksOnText(page), ON_TEXT, 'after an Enter above');
      await page.evaluate(() => {
        const v = window.views.a;
        const items = v.core.decorations();
        v.setDecorations([...items, { kind: 'gap', line: 0, rows: 2 }], v.core.revision);
        v.draw();
      });
      assert.deepEqual(await marksOnText(page), ON_TEXT, 'after a gap');
      await page.evaluate(async () => {
        const v = window.views.a;
        v.scroller.scrollTop = 100000;
        v.draw();
        await window.codepad.frames(1);
        v.scroller.scrollTop = 0;
        v.draw();
      });
      assert.deepEqual(await marksOnText(page), ON_TEXT, 'after a scroll out and back');
      await page.close();
    });

    test('a long line below the page fold paints its matches once the page scrolls to them', async () => {
      const { page } = await open();
      await page.evaluate(() => {
        document.body.style.paddingTop = `${window.innerHeight - 100}px`;
      });
      await editor(page, 'a', 'ab '.repeat(3000), { softWrap: true });
      const low = await page.evaluate(async () => {
        const v = window.views.a;
        // Marks in the lowest 60 px of the editor.
        const low = () => {
          const root = document.getElementById('a').getBoundingClientRect();
          return [...document.querySelectorAll('#a [data-match]')].filter((m) => {
            const r = m.getBoundingClientRect();
            return r.top > root.bottom - 60 && r.top < root.bottom;
          }).length;
        };
        await v.setSearch({ text: 'ab' });
        await window.codepad.frames(2);
        const folded = low();
        window.scrollTo(0, 400);
        await window.codepad.frames(3);
        return [folded, low()];
      });
      assert.equal(low[0], 0, 'below the fold before the scroll');
      assert.ok(low[1] > 0, `after the scroll ${low[1]}`);
      await page.close();
    });

    test('long lines paint only the matches in view, and new ones as the editor scrolls', async () => {
      const { page } = await open();
      await editor(page, 'a', 'ab '.repeat(3000), { softWrap: true });
      // Three unwrapped lines, so the middle one sits between the first and last offsets on screen.
      await editor(page, 'b', Array(3).fill('ab '.repeat(3000)).join('\n'));
      const painted = await page.evaluate(async () => {
        const { a, b } = window.views;
        await Promise.all([a.setSearch({ text: 'ab' }), b.setSearch({ text: 'ab' })]);
        await window.codepad.frames(2);
        const count = (id) => document.querySelectorAll(`#${id} [data-match]`).length;
        // Marks inside the host's box, so a mark scrolled out of view does not count.
        const inBox = (id) => {
          const root = document.getElementById(id).getBoundingClientRect();
          return [...document.querySelectorAll(`#${id} [data-match]`)].filter((m) => {
            const r = m.getBoundingClientRect();
            return (
              r.bottom > root.top &&
              r.top < root.bottom &&
              r.right > root.left &&
              r.left < root.right
            );
          }).length;
        };
        const wrapped = count('a');
        const unwrapped = count('b');
        a.scroller.scrollTop = 1500;
        b.scroller.scrollLeft = 4000;
        await window.codepad.frames(3);
        return {
          wrapped,
          unwrapped,
          inA: inBox('a'),
          inB: inBox('b'),
          scrolledA: count('a'),
          scrolledB: count('b'),
        };
      });
      assert.ok(painted.wrapped < 500, `wrapped ${painted.wrapped}`);
      assert.ok(painted.scrolledA < 500, `wrapped after the scroll ${painted.scrolledA}`);
      assert.ok(painted.unwrapped < 300, `unwrapped ${painted.unwrapped}`);
      assert.ok(painted.inA > 0, `marks in view after the scroll down ${painted.inA}`);
      assert.ok(painted.inB > 0, `marks in view after the scroll right ${painted.inB}`);
      assert.ok(painted.scrolledB < 300, `unwrapped after the scroll ${painted.scrolledB}`);
      await page.close();
    });

    test('one match over a long wrapped line marks only the rows in view, and the rows a scroll brings in', async () => {
      const { page } = await open();
      await editor(page, 'a', 'a'.repeat(100_000), { softWrap: true });
      const out = await page.evaluate(async () => {
        const v = window.views.a;
        await v.setSearch({ text: 'a+', regex: true });
        await window.codepad.frames(2);
        const marks = () => [...document.querySelectorAll('#a [data-match]')];
        // Whether the first and last visible rows of the line each sit under a mark.
        const covered = () => {
          const root = document.getElementById('a').getBoundingClientRect();
          const line = document.querySelector('#a [data-line="0"]').getBoundingClientRect();
          const rects = marks().map((m) => m.getBoundingClientRect());
          const at = (y) => rects.some((r) => r.top <= y && r.bottom >= y);
          const half = v.rowHeight / 2;
          return [
            at(Math.max(root.top, line.top) + half),
            at(Math.min(root.bottom, line.bottom) - half),
          ];
        };
        const lineTop = () =>
          document.querySelector('#a [data-line="0"]').getBoundingClientRect().top;
        const first = marks().length;
        const top = covered();
        const before = lineTop();
        v.scroller.scrollTop = 20_000;
        await window.codepad.frames(3);
        return {
          first,
          top,
          moved: before - lineTop(),
          scrolled: marks().length,
          after: covered(),
        };
      });
      assert.ok(out.first < 200, `marks before the scroll ${out.first}`);
      assert.deepEqual(out.top, [true, true]);
      assert.ok(out.moved > 10_000, `the line moved ${out.moved} px`);
      assert.ok(out.scrolled < 200, `marks after the scroll ${out.scrolled}`);
      assert.deepEqual(out.after, [true, true]);
      await page.close();
    });

    test('replacing a match with the same text keeps a caret on its line', async () => {
      const { page } = await open();
      await page.evaluate(() => window.codepad.ensureLanguage('python'));
      await editor(page, 'a', 'foo = 1\nbar = foo\n');
      const caret = await page.evaluate(async () => {
        const v = window.views.a;
        v.setLanguage('python');
        await window.codepad.until(() => v.core.snapshot !== 0);
        await window.codepad.frames(2);
        v.apply(() => v.core.replace(0, 3, 'foo'));
        // The parse of the new revision lands before the next frame draws.
        while (v.core.m._cpw_pump(1000, 0) > 0);
        await window.codepad.frames(3);
        v.apply(() => v.core.setSelection(2, 2));
        await window.codepad.frames(2);
        return v.caretRect(2);
      });
      assert.notEqual(caret, null);
      await page.close();
    });

    test('ref copy puts the selection on the clipboard', async () => {
      // Playwright grants clipboard permissions in Chromium only.
      if (engine !== chromium) return;
      const { page } = await open();
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await editor(page, 'a', 'hello world');
      const text = await page.evaluate(async () => {
        const v = window.views.a;
        v.apply(() => v.core.setSelection(0, 5));
        await v.copySelection();
        return navigator.clipboard.readText();
      });
      assert.equal(text, 'hello');
      await page.close();
    });

    // Swaps the page clipboard for one whose write and read wait until window.release() runs.
    const slowClipboard = (page) =>
      page.evaluate(() => {
        let release = () => {};
        window.release = () => release();
        const wait = (value) =>
          new Promise((resolve) => {
            release = () => resolve(value);
          });
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: () => wait(undefined), readText: () => wait('XYZ') },
        });
      });

    test('ref cut deletes nothing when the selection moves while the clipboard write is pending', async () => {
      const { page } = await open();
      await editor(page, 'a', 'hello world');
      await slowClipboard(page);
      const text = await page.evaluate(async () => {
        const v = window.views.a;
        v.apply(() => v.core.setSelection(0, 5));
        const cut = v.cutSelection();
        v.apply(() => v.core.setSelection(6, 11));
        window.release();
        await cut;
        return v.core.text();
      });
      assert.equal(text, 'hello world');
      await page.close();
    });

    test('ref cut and paste edit nothing when readOnly turns on while the clipboard is pending', async () => {
      const { page } = await open();
      await editor(page, 'a', 'hello world');
      await slowClipboard(page);
      const texts = await page.evaluate(async () => {
        const v = window.views.a;
        v.apply(() => v.core.setSelection(0, 5));
        const cut = v.cutSelection();
        v.setOptions({ readOnly: true });
        window.release();
        await cut;
        const afterCut = v.core.text();
        v.setOptions({ readOnly: false });
        const paste = v.pasteClipboard();
        v.setOptions({ readOnly: true });
        window.release();
        await paste;
        return [afterCut, v.core.text()];
      });
      assert.deepEqual(texts, ['hello world', 'hello world']);
      await page.close();
    });

    test('ref cut under readOnly changes nothing', async () => {
      const { page } = await open();
      await editor(page, 'a', 'hello world', { readOnly: true });
      const text = await page.evaluate(async () => {
        const v = window.views.a;
        v.apply(() => v.core.setSelection(0, 5));
        await v.cutSelection();
        return v.core.text();
      });
      assert.equal(text, 'hello world');
      await page.close();
    });

    test('ref paste inserts the clipboard text as one undo step', async () => {
      if (engine !== chromium) return;
      const { page } = await open();
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await editor(page, 'a', 'ab');
      const out = await page.evaluate(async () => {
        const v = window.views.a;
        await navigator.clipboard.writeText('XYZ');
        v.apply(() => v.core.setSelection(1, 1));
        await v.pasteClipboard();
        const pasted = v.core.text();
        v.apply(() => v.core.undo());
        return [pasted, v.core.text()];
      });
      assert.deepEqual(out, ['aXYZb', 'ab']);
      await page.close();
    });

    test('ref copy rejects with the secure origin error when navigator.clipboard is missing', async () => {
      const { page } = await open();
      await editor(page, 'a', 'hello');
      const message = await page.evaluate(async () => {
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        const v = window.views.a;
        v.apply(() => v.core.setSelection(0, 5));
        try {
          await v.copySelection();
          return '';
        } catch (e) {
          return e.message;
        }
      });
      assert.match(message, /secure origin/);
      await page.close();
    });

    // Starts an animated scroll to line, runs before() two frames in, and returns the scroll then and after it ends.
    const animate = (page, line, before) =>
      page.evaluate(
        async ([line, before]) => {
          const v = window.views.a;
          const scroller = document.querySelector('#a [data-scroller]');
          v.scrollToLine(line, true);
          await window.codepad.frames(2);
          const mid = scroller.scrollTop;
          if (before === 'setText') v.setText('new\ntext', false);
          if (before === 'wheel')
            scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, bubbles: true }));
          await new Promise((r) => setTimeout(r, 400));
          await window.codepad.frames(2);
          return { mid, end: scroller.scrollTop, target: v.layout.rowHeight * line };
        },
        [line, before],
      );
    const lines = (n) => Array.from({ length: n }, (_, i) => `line ${i}`).join('\n');

    test('an animated scrollToLine ends with the line at the top', async () => {
      const { page } = await open();
      await editor(page, 'a', lines(300));
      const out = await animate(page, 100, '');
      assert.ok(out.mid > 0 && out.mid < out.target, JSON.stringify(out));
      assert.equal(out.end, out.target);
      await page.close();
    });

    test('setText during an animated scrollToLine leaves the new text at the top', async () => {
      const { page } = await open();
      await editor(page, 'a', lines(300));
      const out = await animate(page, 200, 'setText');
      assert.equal(out.end, 0, JSON.stringify(out));
      assert.equal(await textOf(page, 'a'), 'new\ntext');
      await page.close();
    });

    test('a wheel scroll during the animation stops it', async () => {
      const { page } = await open();
      await editor(page, 'a', lines(300));
      const out = await animate(page, 200, 'wheel');
      assert.ok(out.end < out.target * 0.9, JSON.stringify(out));
      await page.close();
    });

    test('an onContentSizeChange that throws in one editor still lets the other draw', async () => {
      const { page, errors } = await open();
      await editor(page, 'a', 'one');
      await editor(page, 'b', 'two');
      const drawn = await page.evaluate(async () => {
        const [a, b] = [window.views.a, window.views.b];
        a.setOptions({
          onContentSize: () => {
            throw new Error('size boom');
          },
        });
        // a draws first in the page's frame, and its new gap changes its content size.
        a.setDecorations([{ kind: 'gap', line: 0, rows: 2 }], -1);
        b.setDecorations([{ kind: 'lineBackground', line: 0, color: 'red' }], -1);
        for (let i = 0; i < 20; i++) {
          if (document.querySelector('#b [data-line-background]')) return true;
          await new Promise((r) => requestAnimationFrame(r));
        }
        return false;
      });
      assert.equal(drawn, true);
      assert.ok(
        errors.some((e) => /size boom/.test(e)),
        String(errors),
      );
      await page.close();
    });

    test('an onReady that throws still autofocuses', async () => {
      const { page, errors } = await open();
      const focused = await page.evaluate(async () => {
        const { EditorView, loadCore, until } = window.codepad;
        const view = new EditorView(document.getElementById('a'), await loadCore(), 'abc');
        view.setOptions({
          autoFocus: true,
          onFirstDraw: () => {
            throw new Error('ready boom');
          },
        });
        window.views = { a: view };
        await until(() => document.querySelector('#a [data-line="0"]'));
        await window.codepad.frames(2);
        return document.activeElement === document.querySelector('#a textarea');
      });
      assert.equal(focused, true);
      assert.ok(
        errors.some((e) => /ready boom/.test(e)),
        String(errors),
      );
      await page.close();
    });

    test('a caret moved below the page fold with scrolling off scrolls the page to it', async () => {
      const { page } = await open();
      await editor(page, 'a', lines(200), { scrollEnabled: false });
      await page.evaluate(async () => {
        const v = window.views.a;
        v.apply(() => v.core.setSelection(v.core.lineStart(150), v.core.lineStart(150)));
        v.focus();
        await window.codepad.frames(2);
      });
      await page.keyboard.press('ArrowDown');
      const top = await page.evaluate(async () => {
        await window.codepad.frames(3);
        return document.querySelector('#a [data-caret]').getBoundingClientRect().top;
      });
      const height = await page.evaluate(() => window.innerHeight);
      assert.ok(top >= 0 && top < height, `caret at ${top} of ${height}`);
      await page.close();
    });

    test('a historyUndo beforeinput undoes in the core and the textarea follows', async () => {
      const { page } = await open();
      await editor(page, 'a', 'abc');
      await clickAt(page, 'a', 0, 3);
      await page.keyboard.type('x');
      const out = await page.evaluate(async () => {
        const ta = document.querySelector('#a textarea');
        const ev = new InputEvent('beforeinput', {
          inputType: 'historyUndo',
          cancelable: true,
          bubbles: true,
        });
        const prevented = !ta.dispatchEvent(ev);
        await window.codepad.frames(2);
        return { text: window.views.a.core.text(), textarea: ta.value, prevented };
      });
      assert.deepEqual(out, { text: 'abc', textarea: 'abc', prevented: true });
      await page.close();
    });

    test('the frame after a letter, an Enter and a joining Backspace keeps the keyword colors', async () => {
      const { page } = await open();
      await page.evaluate(async () => {
        const { EditorView, ensureLanguage, loadCore, until } = window.codepad;
        await ensureLanguage('python');
        const host = document.getElementById('a');
        const view = new EditorView(host, await loadCore(), 'def a():\n    return b\n');
        view.setLanguage('python');
        window.views = { a: view };
        await until(() => host.querySelector('[data-line="1"] span'));
      });
      await clickAt(page, 'a', 0, 8);
      const result = await page.evaluate(async (keyword) => {
        const v = window.views.a;
        const colored = (line) =>
          [...document.querySelectorAll(`#a [data-line="${line}"] span`)].filter(
            (s) => getComputedStyle(s).color === keyword,
          ).length;
        const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
        const out = {};
        v.apply(() => v.core.typeText('x'));
        await nextFrame();
        out.letter = colored(0);
        v.apply(() => v.core.setSelection(20, 20));
        await window.codepad.frames(2);
        v.apply(() => v.core.insertNewline());
        await nextFrame();
        out.enter = colored(1);
        await window.codepad.frames(2);
        const joinFrom = v.core.lineEnd(1);
        v.apply(() => v.core.replace(joinFrom, v.core.selection.head, ''));
        await nextFrame();
        out.join = colored(1);
        out.text = v.core.text();
        return out;
      }, KEYWORD);
      assert.deepEqual(result, {
        letter: 1,
        enter: 1,
        join: 1,
        text: 'def a():x\n    return b\n',
      });
      await page.close();
    });

    test('two edits before a frame and a join under a blank line keep the keyword colors', async () => {
      const { page } = await open();
      const result = await page.evaluate(async (keyword) => {
        const { EditorView, ensureLanguage, frames, loadCore, until } = window.codepad;
        await ensureLanguage('python');
        const host = document.getElementById('a');
        const v = new EditorView(
          host,
          await loadCore(),
          'def a():\n    pass\n\ndef c():\n    pass\n',
        );
        v.setLanguage('python');
        await until(() => host.querySelector('[data-line="3"] span'));
        const colored = (line) =>
          [...host.querySelectorAll(`[data-line="${line}"] span`)].filter(
            (s) => getComputedStyle(s).color === keyword,
          ).length;
        const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
        v.apply(() => v.core.setSelection(8, 8));
        await frames(2);
        v.apply(() => v.core.typeText('x'));
        v.apply(() => v.core.typeText('y'));
        await nextFrame();
        const twice = colored(0);
        await frames(3);
        const blank = v.core.lineEnd(2);
        v.apply(() => v.core.replace(blank, blank + 1, ''));
        await nextFrame();
        return { twice, join: colored(2), text: v.core.text() };
      }, KEYWORD);
      assert.deepEqual(result, {
        twice: 1,
        join: 1,
        text: 'def a():xy\n    pass\ndef c():\n    pass\n',
      });
      await page.close();
    });

    test('PageDown moves by the visible rows', async () => {
      const { page } = await open();
      await editor(page, 'a', Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n'));
      await clickAt(page, 'a', 0, 0);
      // The page the key moves by, read once the first frames have settled the scrollbars.
      const rows = await page.evaluate(async () => {
        await window.codepad.frames(3);
        const v = window.views.a;
        return Math.floor(v.layout.viewportHeight / v.layout.rowHeight);
      });
      await page.keyboard.press('PageDown');
      const result = await page.evaluate(async () => {
        const v = window.views.a;
        await window.codepad.frames(2);
        const caret = v.caretRect(v.core.selection.head);
        return {
          line: v.core.lineAt(v.core.selection.head),
          y: caret?.y ?? null,
        };
      });
      assert.equal(result.line, rows);
      assert.ok(result.y !== null && result.y >= 0 && result.y < 300, `caret y ${result.y}`);
      await page.close();
    });

    test('a caret move after an edit to a line not drawn measures its new text', async () => {
      const { page } = await open();
      await editor(page, 'a', Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n'), {
        softWrap: true,
      });
      const line = await page.evaluate(() => {
        const v = window.views.a;
        v.moveCaret('pageDown', false);
        v.moveCaret('pageDown', false);
        const at = v.core.lineAt(v.core.selection.head);
        const start = v.core.lineStart(at);
        v.apply(() => v.core.replace(start, v.core.lineEnd(at), 'x'.repeat(300)));
        v.apply(() => v.core.setSelection(start + 20, start + 20));
        v.moveCaret('down', false);
        return { at, now: v.core.lineAt(v.core.selection.head) };
      });
      assert.equal(line.now, line.at);
      await page.close();
    });

    test('ArrowDown into right-to-left text lands on the nearest column', async () => {
      const { page } = await open();
      await editor(page, 'a', 'abcdefghijklmnopq\nab مرحبا بالعالم cd');
      const columns = await page.evaluate(() => {
        const v = window.views.a;
        const out = [];
        for (let c = 4; c <= 15; c++) {
          v.apply(() => v.core.setSelection(c, c));
          const goal = v.caretRect(c).x;
          v.moveCaret('down', false);
          const start = v.core.lineStart(1);
          const x = (o) => v.caretRect(o).x;
          let best = Infinity;
          for (let o = start; o <= v.core.lineEnd(1); o++)
            best = Math.min(best, Math.abs(x(o) - goal));
          out.push(Math.abs(x(v.core.selection.head) - goal) - best);
        }
        return out;
      });
      assert.ok(Math.max(...columns) < 1, `extra distance ${columns}`);
      await page.close();
    });

    test('Shift+ArrowRight draws a selection', async () => {
      const { page } = await open();
      await editor(page, 'a', 'abcdef');
      await clickAt(page, 'a', 0, 1);
      await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.press('Shift+ArrowRight');
      const result = await page.evaluate(async () => {
        const v = window.views.a;
        await window.codepad.frames(2);
        const boxes = [...document.querySelectorAll('#a [data-selection] > div')];
        return { selection: v.core.selection, width: boxes[0]?.getBoundingClientRect().width ?? 0 };
      });
      assert.deepEqual(result.selection, { anchor: 1, head: 3 });
      assert.ok(result.width > 0, 'no selection drawn');
      await page.close();
    });

    test('Tab indents, keeps the focus, and the platform undo key takes it back', async () => {
      const { page } = await open();
      await editor(page, 'a', 'abc');
      await clickAt(page, 'a', 0, 0);
      await page.keyboard.press('Tab');
      assert.notEqual(await textOf(page, 'a'), 'abc');
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'TEXTAREA');
      await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+z`);
      assert.equal(await textOf(page, 'a'), 'abc');
      await page.close();
    });

    test('ref typeText auto-closes and moveCaret up keeps the goal column', async () => {
      const { page } = await open();
      await editor(page, 'a', 'abcdefghij\nab\nabcdef');
      const result = await page.evaluate(() => {
        const v = window.views.a;
        v.apply(() => v.core.setSelection(20, 20));
        v.typeText('(');
        const typed = { text: v.core.text(), head: v.core.selection.head };
        v.moveCaret('up', false);
        const first = v.core.selection.head;
        v.moveCaret('up', false);
        return { typed, first, second: v.core.selection.head };
      });
      assert.deepEqual(result, {
        typed: { text: 'abcdefghij\nab\nabcdef()', head: 21 },
        first: 13,
        second: 7,
      });
      await page.close();
    });

    test('the typing ref methods do nothing under readOnly while moveCaret still moves', async () => {
      const { page } = await open();
      await editor(page, 'a', 'abc', { readOnly: true });
      const result = await page.evaluate(() => {
        const v = window.views.a;
        v.apply(() => v.core.setSelection(1, 1));
        v.typeText('x');
        v.deleteBackward();
        v.deleteForward();
        v.moveCaret('right', true);
        return { text: v.core.text(), selection: v.core.selection };
      });
      assert.deepEqual(result, { text: 'abc', selection: { anchor: 1, head: 2 } });
      await page.close();
    });

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

    test('a composition ended just before unmount reads nothing from the closed core', async () => {
      const { page, errors } = await open();
      const reads = await page.evaluate(async () => {
        const { EditorView, loadCore, until } = window.codepad;
        const m = await loadCore();
        const a = new EditorView(document.getElementById('a'), m, 'first');
        await until(() => document.querySelector('#a [data-line="0"]'));
        const ta = document.querySelector('#a textarea');
        ta.dispatchEvent(new CompositionEvent('compositionstart'));
        ta.dispatchEvent(new CompositionEvent('compositionend'));
        a.destroy();
        let count = 0;
        Object.defineProperty(a.core, 'selection', {
          get: () => {
            count++;
            return { anchor: 0, head: 0 };
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
        return count;
      });
      assert.equal(reads, 0);
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

    test('wrapped lines of every length stack without overlapping', async () => {
      const { page, errors } = await open();
      const count = await page.evaluate(async () => {
        const { EditorView, frames, loadCore, overlaps, until } = window.codepad;
        const host = document.getElementById('a');
        const text = Array.from({ length: 12 }, (_, i) => 'word '.repeat(10 + i * 7)).join('\n');
        const view = new EditorView(host, await loadCore(), text);
        view.setOptions({ softWrap: true });
        await until(() => host.querySelector('[data-line="0"]'));
        await frames(5);
        return overlaps('a');
      });
      assert.equal(count, 0);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('a theme that makes keywords bold measures wrapped lines again', async () => {
      const { page, errors } = await open();
      const result = await page.evaluate(async () => {
        const { EditorView, frames, githubLight, loadCore, overlaps, until } = window.codepad;
        const host = document.getElementById('a');
        const text = `x = a ${'and not b '.repeat(150)}\ny = 1\n`;
        const view = new EditorView(host, await loadCore(), text);
        view.setOptions({ softWrap: true, fontFamily: 'Arial' });
        view.setLanguage('python');
        await until(() => host.querySelector('[data-line="0"] span'));
        await frames(3);
        const bold = { ...githubLight, tokens: { ...githubLight.tokens } };
        for (const name of Object.keys(bold.tokens)) {
          if (name.startsWith('keyword')) bold.tokens[name] = { color: '#cf222e', bold: true };
        }
        view.setOptions({ theme: bold });
        await frames(5);
        return { lines: host.querySelectorAll('[data-line]').length, overlaps: overlaps('a') };
      });
      assert.ok(result.lines >= 2, `only ${result.lines} line drawn, nothing to overlap`);
      assert.equal(result.overlaps, 0);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('revealSelection shows the caret on a later row of a wrapped line', async () => {
      const { page, errors } = await open();
      const y = await page.evaluate(async () => {
        const { EditorView, frames, loadCore, until } = window.codepad;
        const host = document.getElementById('a');
        const text = `${'word '.repeat(600)}\nend`;
        const view = new EditorView(host, await loadCore(), text);
        view.setOptions({ softWrap: true });
        await until(() => host.querySelector('[data-line="0"]'));
        await frames(3);
        const head = view.core.lineEnd(0);
        view.apply(() => view.core.setSelection(head, head));
        view.revealSelection();
        await frames(5);
        return view.caretRect(head)?.y ?? null;
      });
      assert.ok(y !== null && y >= 0 && y < 300, `caret y ${y}`);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('turning scrolling back on gives the editor its host height again', async () => {
      const { page, errors } = await open();
      const result = await page.evaluate(async () => {
        const { EditorView, frames, loadCore, until } = window.codepad;
        const host = document.getElementById('a');
        const text = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
        const view = new EditorView(host, await loadCore(), text);
        view.setOptions({ scrollEnabled: false });
        await until(() => host.firstElementChild.getBoundingClientRect().height > 300);
        view.setOptions({ scrollEnabled: true });
        await frames(5);
        const scroller = host.querySelector('[data-scroller]');
        return {
          height: host.firstElementChild.getBoundingClientRect().height,
          overflowY: getComputedStyle(scroller).overflowY,
        };
      });
      assert.deepEqual(result, { height: 300, overflowY: 'auto' });
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
      const warned = page.waitForEvent('console', (m) => /python\.wasm/.test(m.text()));
      await page.evaluate(async () => {
        const { EditorView, loadCore, until } = window.codepad;
        const view = new EditorView(
          document.getElementById('a'),
          await loadCore(),
          'def f():\n    pass\n',
        );
        view.setLanguage('python');
        await until(() => document.querySelector('#a [data-line="0"]')?.textContent === 'def f():');
      });
      await warned;
      const result = await page.evaluate(async () => {
        await window.codepad.frames(2);
        return document.querySelectorAll('#a [data-line] span').length;
      });
      assert.equal(result, 0);
      assert.equal(warnings.length, 1, String(warnings));
      assert.match(warnings[0], /\/build\/web-e2e\/missing\/codepad\/python\.wasm/);
      assert.deepEqual(errors, []);
      await page.close();
    });

    // The color of "func" in a Go fence, a language no injection query names, so only the fence loads it.
    async function fenceKeywordColor(page, hosts) {
      return page.evaluate(async (ids) => {
        const { EditorView, loadCore, until } = window.codepad;
        const m = await loadCore();
        const text = '# Title\n```go\nfunc f() {}\n```\n';
        const def = (id) =>
          [...document.querySelectorAll(`#${id} [data-line="2"] span`)].find(
            (s) => s.textContent === 'func',
          );
        const colors = [];
        for (const id of ids) {
          new EditorView(document.getElementById(id), m, text).setLanguage('markdown');
          await until(() => def(id) && getComputedStyle(def(id)).color !== 'rgb(31, 35, 40)');
          colors.push(getComputedStyle(def(id)).color);
        }
        return colors;
      }, hosts);
    }

    test('a markdown fence colors go, which no injection query names', async () => {
      const { page, errors } = await open();
      assert.deepEqual(await fenceKeywordColor(page, ['a']), [KEYWORD]);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('a second markdown editor colors the same fence', async () => {
      const { page, errors } = await open();
      assert.deepEqual(await fenceKeywordColor(page, ['a', 'b']), [KEYWORD, KEYWORD]);
      assert.deepEqual(errors, []);
      await page.close();
    });

    test('a fence naming a language that is not installed draws plain and refreshes nothing', async () => {
      const { page, errors } = await open();
      const refreshes = await page.evaluate(async () => {
        const { EditorView, frames, loadCore, until } = window.codepad;
        const view = new EditorView(
          document.getElementById('a'),
          await loadCore(),
          '```zig\nconst x = 1;\n```\n',
        );
        let count = 0;
        const refresh = view.core.refreshInjections.bind(view.core);
        view.core.refreshInjections = () => {
          count++;
          refresh();
        };
        view.setLanguage('markdown');
        await until(() => view.core.snapshotCount > 0);
        await frames(10);
        return count;
      });
      assert.equal(refreshes, 0);
      assert.deepEqual(errors, []);
      await page.close();
    });
  });
}
