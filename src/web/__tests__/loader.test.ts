import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import type { CoreModule } from '../core/module';

type Loader = typeof import('../loader');

const MANIFEST = {
  version: 1,
  core: { js: 'codepad.js', wasm: 'codepad.wasm' },
  languages: [
    lang('css', null),
    lang('javascript', 'javascript.injections.scm'),
    lang('html', 'html.injections.scm'),
    lang('python', null),
  ],
};
const HTML_INJECTIONS = `((style_element (raw_text) @injection.content)
 (#set! injection.language "css"))
((script_element (raw_text) @injection.content)
 (#set! injection.language "javascript"))
((comment) @injection.content (#set! injection.language "comment"))`;
const JAVASCRIPT_INJECTIONS = `((template_string) @injection.content
 (#set! injection.language "html"))`;

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
let manifestText: string;
let appended: number;
let warn: jest.SpiedFunction<typeof console.warn>;
const loaded: string[] = [];

beforeEach(() => {
  jest.resetModules();
  loader = require('../loader') as Loader;
  missing = new Set();
  manifestText = JSON.stringify(MANIFEST);
  appended = 0;
  loaded.length = 0;
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const g = globalThis as Record<string, unknown>;
  g.fetch = jest.fn(async (url: string) => {
    const file = url.slice('/codepad/'.length);
    if (missing.has(file)) return { ok: false, status: 404 };
    const bodies: Record<string, string> = {
      'languages.json': manifestText,
      'html.injections.scm': HTML_INJECTIONS,
      'javascript.injections.scm': JAVASCRIPT_INJECTIONS,
    };
    const body = bodies[file] ?? '';
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

// Resolves with the value, or with 'hung' when the promise is still pending after a short wait.
function settled<T>(promise: Promise<T>): Promise<T | 'hung'> {
  return Promise.race([promise, new Promise<'hung'>((r) => setTimeout(() => r('hung'), 200))]);
}

test('loads every language the injection queries name before it resolves', async () => {
  const m = await loader.loadCore();
  await expect(loader.ensureLanguage(m, 'html')).resolves.toBe(true);
  expect([...loaded].sort()).toEqual(['css', 'html', 'javascript']);
  expect(warn).not.toHaveBeenCalled();
});

test('loads two languages that inject each other when both start at once', async () => {
  const m = await loader.loadCore();
  const both = Promise.all([
    loader.ensureLanguage(m, 'javascript'),
    loader.ensureLanguage(m, 'html'),
  ]);
  await expect(settled(both)).resolves.toEqual([true, true]);
  expect([...loaded].sort()).toEqual(['css', 'html', 'javascript']);
});

test('warns once and resolves false when languages.json is a page, not the manifest', async () => {
  manifestText = '<!DOCTYPE html><html></html>';
  const m = await loader.loadCore();
  await expect(settled(loader.ensureLanguage(m, 'python'))).resolves.toBe(false);
  await expect(settled(loader.ensureLanguage(m, 'javascript'))).resolves.toBe(false);
  expect(warn.mock.calls).toEqual([
    [
      '[codepad] /codepad/languages.json is not the file the web command writes. Run npx react-native-codepad web <public-dir>.',
    ],
  ]);
  expect(loader.availableLanguages()).toEqual([]);
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
