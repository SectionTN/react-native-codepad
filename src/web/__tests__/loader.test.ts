import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import type { CoreModule } from '../core/module';

type Loader = typeof import('../loader');

const MANIFEST = {
  version: 1,
  core: { js: 'codepad.js', wasm: 'codepad.wasm' },
  languages: [
    lang('css', null),
    lang('javascript', null),
    lang('html', 'html.injections.scm'),
    lang('python', null),
  ],
};
const HTML_INJECTIONS = `((style_element (raw_text) @injection.content)
 (#set! injection.language "css"))
((script_element (raw_text) @injection.content)
 (#set! injection.language "javascript"))
((comment) @injection.content (#set! injection.language "comment"))`;

function lang(id: string, injections: string | null) {
  return {
    id,
    wasm: `${id}.wasm`,
    symbol: `tree_sitter_${id}`,
    highlights: `${id}.highlights.scm`,
    injections,
  };
}

// A module that records the languages it was asked to load, in order.
function fakeModule(loaded: string[]): CoreModule {
  const strings: string[] = [];
  return {
    FS: {
      writeFile: () => {},
      createPreloadedFile: (
        _p: string,
        _n: string,
        _d: unknown,
        _r: boolean,
        _w: boolean,
        onload?: () => void,
      ) => onload?.(),
    },
    stringToNewUTF8: (s: string) => strings.push(s) - 1,
    UTF8ToString: (p: number) => strings[p] ?? '',
    _free: () => {},
    _cpw_language_alias: () => {},
    _cpw_error: () => strings.push('no error') - 1,
    _cpw_language_load: (id: number) => {
      loaded.push(strings[id] as string);
      return 1;
    },
  } as unknown as CoreModule;
}

let loader: Loader;
let missing: Set<string>;
let appended: number;
let warn: jest.SpiedFunction<typeof console.warn>;
const loaded: string[] = [];

beforeEach(() => {
  jest.resetModules();
  loader = require('../loader') as Loader;
  missing = new Set();
  appended = 0;
  loaded.length = 0;
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const g = globalThis as Record<string, unknown>;
  g.fetch = jest.fn(async (url: string) => {
    const file = url.slice('/codepad/'.length);
    if (missing.has(file)) return { ok: false, status: 404 };
    const body =
      file === 'languages.json'
        ? JSON.stringify(MANIFEST)
        : file === 'html.injections.scm'
          ? HTML_INJECTIONS
          : '';
    return {
      ok: true,
      status: 200,
      text: async () => body,
      arrayBuffer: async () => new ArrayBuffer(8),
    };
  });
  g.createCodepadCore = undefined;
  g.document = {
    createElement: () => ({}),
    head: {
      appendChild: (script: { onload?: () => void }) => {
        appended++;
        g.createCodepadCore = async () => fakeModule(loaded);
        setTimeout(() => script.onload?.(), 0);
      },
    },
  };
});

afterEach(() => {
  warn.mockRestore();
});

test('loads injected languages before the host language', async () => {
  const m = await loader.loadCore();
  await expect(loader.ensureLanguage(m, 'html')).resolves.toBe(true);
  expect(loaded).toEqual(['css', 'javascript', 'html']);
  expect(warn).not.toHaveBeenCalled();
});

test('warns once and resolves false for an id the manifest lacks', async () => {
  const m = await loader.loadCore();
  await expect(loader.ensureLanguage(m, 'cobol')).resolves.toBe(false);
  await expect(loader.ensureLanguage(m, 'cobol')).resolves.toBe(false);
  expect(warn.mock.calls).toEqual([
    ['[codepad] language "cobol" is not in /codepad/languages.json'],
  ]);
  expect(loaded).toEqual([]);
});

test('warns with the url when a grammar fetch fails', async () => {
  missing.add('python.wasm');
  const m = await loader.loadCore();
  await expect(loader.ensureLanguage(m, 'python')).resolves.toBe(false);
  expect(warn.mock.calls).toEqual([['[codepad] could not load /codepad/python.wasm: 404']]);
  expect(loaded).toEqual([]);
});

test('injects the core script once for two editors', async () => {
  const [a, b] = await Promise.all([loader.loadCore(), loader.loadCore()]);
  expect(a).toBe(b);
  expect(appended).toBe(1);
});
