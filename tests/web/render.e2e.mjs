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
