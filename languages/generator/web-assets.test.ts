import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { copyWebAssets, WebAssetsError } from './web-assets.ts';

function write(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

// An app with the core, two language packages (one holding two grammars) and a plain dependency.
function fakeApp(): { app: string; core: string; out: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'codepad-web-'));
  const app = path.join(dir, 'app');
  const core = path.join(dir, 'core');
  write(path.join(core, 'codepad.js'), 'js');
  write(path.join(core, 'codepad.wasm'), 'wasm');
  const deps = { 'lang-a': '*', 'lang-b': '*', lodash: '*' };
  write(path.join(app, 'package.json'), JSON.stringify({ name: 'app', dependencies: deps }));
  const mod = (name: string) => path.join(app, 'node_modules', name);
  write(path.join(mod('lang-a'), 'package.json'), JSON.stringify({ name: 'lang-a', codepad: {} }));
  write(path.join(mod('lang-a'), 'web/a.wasm'), 'a');
  write(path.join(mod('lang-a'), 'queries/a/highlights.scm'), '(x) @a');
  write(path.join(mod('lang-a'), 'queries/a/injections.scm'), '(y) @injection.content');
  write(path.join(mod('lang-b'), 'package.json'), JSON.stringify({ name: 'lang-b', codepad: {} }));
  for (const g of ['b', 'b_inline']) {
    write(path.join(mod('lang-b'), `web/${g}.wasm`), g);
    write(path.join(mod('lang-b'), `queries/${g}/highlights.scm`), `(${g}) @b`);
  }
  write(path.join(mod('lodash'), 'package.json'), JSON.stringify({ name: 'lodash' }));
  return { app, core, out: path.join(dir, 'public') };
}

test('copies the core and each language with its queries', () => {
  const { app, core, out } = fakeApp();
  const manifest = copyWebAssets(app, out, core);
  const dest = path.join(out, 'codepad');
  assert.equal(readFileSync(path.join(dest, 'codepad.wasm'), 'utf8'), 'wasm');
  assert.equal(readFileSync(path.join(dest, 'codepad.js'), 'utf8'), 'js');
  assert.deepEqual(manifest, {
    version: 1,
    core: { js: 'codepad.js', wasm: 'codepad.wasm' },
    languages: [
      {
        id: 'a',
        wasm: 'a.wasm',
        symbol: 'tree_sitter_a',
        highlights: 'a.highlights.scm',
        injections: 'a.injections.scm',
      },
      {
        id: 'b',
        wasm: 'b.wasm',
        symbol: 'tree_sitter_b',
        highlights: 'b.highlights.scm',
        injections: null,
      },
      {
        id: 'b_inline',
        wasm: 'b_inline.wasm',
        symbol: 'tree_sitter_b_inline',
        highlights: 'b_inline.highlights.scm',
        injections: null,
      },
    ],
  });
  assert.deepEqual(JSON.parse(readFileSync(path.join(dest, 'languages.json'), 'utf8')), manifest);
  assert.equal(readFileSync(path.join(dest, 'b_inline.wasm'), 'utf8'), 'b_inline');
  assert.equal(readFileSync(path.join(dest, 'a.injections.scm'), 'utf8'), '(y) @injection.content');
});

test('throws naming a package without its wasm', () => {
  const { app, core, out } = fakeApp();
  write(path.join(app, 'node_modules/lang-b/queries/c/highlights.scm'), '(c) @c');
  assert.throws(
    () => copyWebAssets(app, out, core),
    (e: unknown) => {
      assert.ok(e instanceof WebAssetsError);
      assert.match(e.message, /lang-b has no web\/c\.wasm/);
      return true;
    },
  );
});

test('ignores dependencies without a codepad field', () => {
  const { app, core, out } = fakeApp();
  write(path.join(app, 'node_modules/lodash/web/x.wasm'), 'x');
  write(path.join(app, 'node_modules/lodash/queries/x/highlights.scm'), '(x) @x');
  const ids = copyWebAssets(app, out, core).languages.map((l) => l.id);
  assert.deepEqual(ids, ['a', 'b', 'b_inline']);
  assert.ok(!existsSync(path.join(out, 'codepad/x.wasm')));
});

test('finds the custom languages in the app modules folder', () => {
  const { app, core, out } = fakeApp();
  const local = path.join(app, 'modules/codepad-lang-algo');
  write(
    path.join(local, 'package.json'),
    JSON.stringify({ name: 'codepad-lang-algo', codepad: {} }),
  );
  write(path.join(local, 'web/algo.wasm'), 'algo');
  write(path.join(local, 'queries/algo/highlights.scm'), '(x) @algo');
  const ids = copyWebAssets(app, out, core).languages.map((l) => l.id);
  assert.deepEqual(ids, ['a', 'b', 'b_inline', 'algo']);
});

test('a custom package renamed with --id keeps its grammar entry point', () => {
  const { app, core, out } = fakeApp();
  const local = path.join(app, 'modules/codepad-lang-kv');
  const json = { name: 'codepad-lang-kv', codepad: { symbol: 'kv_lite' } };
  write(path.join(local, 'package.json'), JSON.stringify(json));
  write(path.join(local, 'web/kv.wasm'), 'kv');
  write(path.join(local, 'queries/kv/highlights.scm'), '(x) @kv');
  const kv = copyWebAssets(app, out, core).languages.find((l) => l.id === 'kv');
  assert.equal(kv?.symbol, 'tree_sitter_kv_lite');
});

test('refuses a grammar named codepad, which would replace the core', () => {
  const { app, core, out } = fakeApp();
  const local = path.join(app, 'modules/codepad-lang-codepad');
  write(
    path.join(local, 'package.json'),
    JSON.stringify({ name: 'codepad-lang-codepad', codepad: {} }),
  );
  write(path.join(local, 'web/codepad.wasm'), 'grammar');
  write(path.join(local, 'queries/codepad/highlights.scm'), '(x) @codepad');
  assert.throws(
    () => copyWebAssets(app, out, core),
    (e: unknown) => {
      assert.ok(e instanceof WebAssetsError);
      assert.match(e.message, /codepad-lang-codepad.*codepad/);
      return true;
    },
  );
  assert.equal(readFileSync(path.join(out, 'codepad/codepad.wasm'), 'utf8'), 'wasm');
});
