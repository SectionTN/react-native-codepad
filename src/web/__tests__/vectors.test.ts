import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { builtCore, loadCore, loadGrammar, pumpAll, ROOT } from '../../../tests/web/core';
import type { Decoration } from '../../types';
import { EditorCore, type MoveUnit, SearchError, type WebChange } from '../core/EditorCore';
import { type Anchor, Layout } from '../core/Layout';
import type { CoreModule } from '../core/module';

type Json = Record<string, unknown>;

const dir = builtCore('build/web-test', 'cpp/web/build.sh --test');
const files = readdirSync(join(ROOT, 'tests/vectors'))
  .filter((f) => f.endsWith('.json'))
  .sort();
let m: CoreModule;

beforeAll(async () => {
  if (dir) m = await loadCore(dir);
});

afterAll(() => {
  if (dir) pumpAll(m);
});

// Line for line port of tests/swift/VectorRunner.swift: the same ops, the same expect keys, the same messages.
class VectorRunner {
  private clock = 0;
  private readonly core: EditorCore;
  private changes: WebChange[] = [];
  private lastResult: unknown = null;
  private lastError: string | null = null;
  private layoutView: Layout | null = null;
  private anchor: Anchor | null = null;
  private widthChanged = false;

  constructor(private readonly testCase: Json) {
    this.core = new EditorCore(m, (testCase.text as string | undefined) ?? '');
    this.core.setClock(0);
  }

  private layout(op: Json): void {
    let vp = this.layoutView;
    if (!vp) {
      vp = new Layout(this.core);
      vp.attach();
      this.layoutView = vp;
    }
    const before = vp.textAreaWidth;
    const insets = (op.insets as number[] | undefined) ?? [0, 0, 0, 0];
    vp.rowHeight = int(op, 'rowHeight');
    vp.gutterWidth = int(op, 'gutter');
    vp.textPadding = int(op, 'padding');
    vp.wrap = bool(op, 'wrap', false);
    vp.resize(int(op, 'width'), int(op, 'height'));
    vp.setInsets(
      insets[0] as number,
      insets[1] as number,
      insets[2] as number,
      insets[3] as number,
    );
    this.widthChanged = vp.textAreaWidth !== before;
  }

  run(): void {
    const ops = (this.testCase.ops as Json[] | undefined) ?? [];
    ops.forEach((op, i) => {
      this.lastResult = null;
      this.lastError = null;
      this.apply(op);
      this.changes.push(...this.core.takeChanges());
      if (op.expect) this.check(op.expect as Json, `after op ${i + 1} (${string(op, 'op')})`);
    });
    if (this.testCase.expect) this.check(this.testCase.expect as Json, 'at end');
  }

  close(): void {
    this.core.close();
  }

  private apply(op: Json): void {
    const core = this.core;
    const name = string(op, 'op');
    const vp = this.layoutView;
    switch (name) {
      case 'replace':
        core.replace(int(op, 'start'), int(op, 'end'), string(op, 'text'));
        break;
      case 'setSelection':
        core.setSelection(int(op, 'anchor'), int(op, 'head'));
        break;
      case 'selectAll':
        core.selectAll();
        break;
      case 'move':
        core.move(string(op, 'unit') as MoveUnit, int(op, 'dir') > 0, bool(op, 'extend', false));
        break;
      case 'selectWord':
        core.selectWordAt(int(op, 'offset'));
        break;
      case 'type':
        core.typeText(string(op, 'text'));
        break;
      case 'insertText':
        core.insertText(string(op, 'text'));
        break;
      case 'setText':
        core.setText(string(op, 'text'), bool(op, 'keepHistory', false));
        break;
      case 'backspace':
        core.backspace();
        break;
      case 'delete':
        core.delete();
        break;
      case 'undo':
        this.lastResult = core.undo();
        break;
      case 'redo':
        this.lastResult = core.redo();
        break;
      case 'enter':
        core.insertNewline();
        break;
      case 'tab':
        core.tab();
        break;
      case 'shiftTab':
        core.shiftTab();
        break;
      case 'indent':
        core.indent();
        break;
      case 'outdent':
        core.outdent();
        break;
      case 'bracketMatch':
        this.lastResult = core.bracketMatch(0);
        break;
      case 'search':
        try {
          core.setSearch({
            text: string(op, 'text'),
            regex: bool(op, 'regex', false),
            caseSensitive: bool(op, 'caseSensitive', false),
            wholeWord: bool(op, 'wholeWord', false),
          });
          core.ensureMatches();
          this.lastResult = core.matchCount;
        } catch (error) {
          this.lastError = error instanceof SearchError ? error.message : 'invalid';
        }
        break;
      case 'findNext':
        this.lastResult = core.findNext();
        break;
      case 'findPrevious':
        this.lastResult = core.findPrevious();
        break;
      case 'replaceCurrent':
        this.lastResult = core.replaceCurrent(string(op, 'text'));
        break;
      case 'replaceAll':
        this.lastResult = core.replaceAll(string(op, 'text'));
        break;
      case 'clearSearch':
        core.clearSearch();
        break;
      case 'config': {
        const s = core.settings;
        core.settings = {
          tabSize: (op.tabSize as number | undefined) ?? s.tabSize,
          insertSpaces: (op.insertSpaces as boolean | undefined) ?? s.insertSpaces,
          autoIndent: (op.autoIndent as boolean | undefined) ?? s.autoIndent,
          autoCloseBrackets: (op.autoCloseBrackets as boolean | undefined) ?? s.autoCloseBrackets,
        };
        break;
      }
      case 'offsetToPosition':
        this.lastResult = core.offsetToPosition(int(op, 'offset'));
        break;
      case 'positionToOffset':
        this.lastResult = core.positionToOffset(int(op, 'line'), int(op, 'column'));
        break;
      case 'getLine':
        this.lastResult = core.line(int(op, 'index'));
        break;
      case 'wait':
        this.clock += int(op, 'ms');
        core.setClock(this.clock);
        break;
      case 'decorate':
        core.setDecorations(
          ((op.items as Json[] | undefined) ?? []).map(decorationOf),
          (op.revision as number | undefined) ?? -1,
        );
        break;
      case 'layout':
        this.layout(op);
        break;
      case 'measure': {
        if (!vp) throw new Error('measure before layout');
        for (const pair of (op.pairs as number[][] | undefined) ?? []) {
          vp.measured(pair[0] as number, pair[1] as number);
        }
        const widest = op.widest as number | undefined;
        if (widest !== undefined && !vp.wrap) vp.widestLine = Math.max(vp.widestLine, widest);
        break;
      }
      case 'scrollTo':
        if (vp) this.lastResult = vp.scrollTo(int(op, 'x'), int(op, 'y'));
        break;
      case 'scrollBy':
        if (vp)
          this.lastResult = vp.scrollTo(vp.scrollX + int(op, 'dx'), vp.scrollY + int(op, 'dy'));
        break;
      case 'reveal':
        if (vp) {
          this.lastResult = vp.reveal(
            int(op, 'left'),
            int(op, 'top'),
            int(op, 'right'),
            int(op, 'bottom'),
          );
        }
        break;
      case 'anchor':
        this.anchor = vp?.anchor() ?? null;
        break;
      case 'restore':
        if (this.anchor) vp?.restore(this.anchor);
        break;
      case 'resetRows':
        vp?.resetRows();
        break;
      default:
        throw new Error(`op not implemented: ${name}`);
    }
  }

  private check(expect: Json, at: string): void {
    const core = this.core;
    const same = (key: string, actual: unknown, expected: unknown) =>
      expectEqual(`${key} ${at}`, actual, expected);
    if (expect.decorations) {
      same(
        'decorations',
        core.decorations().map(describeDecoration),
        (expect.decorations as Json[]).map((d) => describeDecoration(decorationOf(d))),
      );
    }
    if (expect.gapRows) {
      const expected: Record<string, number> = {};
      for (const [k, v] of Object.entries(expect.gapRows as Json)) expected[k] = v as number;
      same('gapRows', Object.fromEntries(core.gapRows()), expected);
    }
    if (typeof expect.text === 'string') same('text', core.text(), expect.text);
    if (typeof expect.length === 'number') same('length', core.length, expect.length);
    if (typeof expect.lineCount === 'number') same('lineCount', core.lineCount, expect.lineCount);
    if (typeof expect.revision === 'number') same('revision', core.revision, expect.revision);
    if (expect.selection) {
      const s = expect.selection as Json;
      same('selection', core.selection, { anchor: int(s, 'anchor'), head: int(s, 'head') });
    }
    if (expect.position) {
      const p = expect.position as Json;
      same('position', this.lastResult, { line: int(p, 'line'), column: int(p, 'column') });
    }
    if (typeof expect.canUndo === 'boolean') same('canUndo', core.canUndo, expect.canUndo);
    if (typeof expect.canRedo === 'boolean') same('canRedo', core.canRedo, expect.canRedo);
    if (typeof expect.offset === 'number') same('offset', this.lastResult, expect.offset);
    if (typeof expect.line === 'string') same('line', this.lastResult, expect.line);
    if (expect.matches) same('matches', core.matches, (expect.matches as number[][]).flat());
    if ('found' in expect) {
      const f = expect.found as Json | null;
      same('found', this.lastResult, f ? { index: int(f, 'index'), total: int(f, 'total') } : null);
    }
    if ('result' in expect) this.checkResult(expect.result, at);
    if (typeof expect.limited === 'boolean') same('limited', core.matchLimited, expect.limited);
    if ('brackets' in expect) same('brackets', this.lastResult, expect.brackets);
    if (expect.changes) {
      const list = expect.changes as Json[];
      same('change count', this.changes.length, list.length);
      list.forEach((e, i) => {
        const c = this.changes[i];
        if (!c) return;
        same(`change ${i} start`, c.start, int(e, 'start'));
        same(`change ${i} end`, c.start + c.removedLength, int(e, 'end'));
        same(`change ${i} text`, c.inserted, string(e, 'text'));
        same(`change ${i} origin`, c.origin, string(e, 'origin'));
      });
    }
    if (typeof expect.error === 'boolean') {
      same(
        expect.error ? 'error expected' : 'no error expected',
        this.lastError !== null,
        expect.error,
      );
    }
    this.checkLayout(expect, at);
  }

  private checkLayout(expect: Json, at: string): void {
    const vp = this.layoutView;
    if (!vp) return;
    const same = (key: string, actual: unknown, expected: unknown) =>
      expectEqual(`${key} ${at}`, actual, expected);
    if (typeof expect.widthChanged === 'boolean')
      same('widthChanged', this.widthChanged, expect.widthChanged);
    if (expect.scroll) same('scroll', [vp.scrollX, vp.scrollY], expect.scroll);
    if (expect.maxScroll) same('maxScroll', [vp.maxScrollX, vp.maxScrollY], expect.maxScroll);
    if (expect.content) same('content', [vp.contentWidth, vp.contentHeight], expect.content);
    if (expect.visible)
      same('visible', [vp.firstVisibleLine(), vp.lastVisibleLine()], expect.visible);
    if (typeof expect.totalRows === 'number') same('totalRows', vp.totalRows, expect.totalRows);
    for (const [k, v] of Object.entries((expect.rowStart as Json | undefined) ?? {})) {
      same(`rowStart ${k}`, vp.rowStart(Number(k)), v);
    }
    for (const [k, v] of Object.entries((expect.lineAtRow as Json | undefined) ?? {})) {
      same(`lineAtRow ${k}`, vp.lineAtRow(Number(k)), v);
    }
    for (const [k, v] of Object.entries((expect.isGapRow as Json | undefined) ?? {})) {
      same(`isGapRow ${k}`, vp.isGapRow(Number(k)), v);
    }
    for (const [k, v] of Object.entries((expect.lineTop as Json | undefined) ?? {})) {
      same(`lineTop ${k}`, vp.lineTop(Number(k)), v);
    }
  }

  private checkResult(expected: unknown, at: string): void {
    if (typeof expected === 'boolean' || typeof expected === 'number') {
      expectEqual(`result ${at}`, this.lastResult, expected);
    } else {
      throw new Error(`result ${at}: unsupported expectation ${String(expected)}`);
    }
  }
}

function expectEqual(what: string, actual: unknown, expected: unknown): void {
  expect({ what, value: actual }).toEqual({ what, value: expected });
}

function decorationOf(o: Json): Decoration {
  switch (string(o, 'kind')) {
    case 'underline':
      return {
        kind: 'underline',
        range: { start: int(o, 'start'), end: int(o, 'end') },
        color: '#000000',
        thickness: (o.thickness as number | undefined) ?? 1,
      };
    case 'gap':
      return { kind: 'gap', line: int(o, 'line'), rows: int(o, 'rows') };
    case 'lineBackground':
      return { kind: 'lineBackground', line: int(o, 'line'), color: '#000000' };
    default:
      throw new Error(`unknown decoration kind ${string(o, 'kind')}`);
  }
}

// Only what mapping changes: kind and range, or kind, line and rows.
function describeDecoration(d: Decoration): string {
  switch (d.kind) {
    case 'underline':
      return `underline ${d.range.start} ${d.range.end}`;
    case 'gap':
      return `gap ${d.line} ${d.rows}`;
    case 'lineBackground':
      return `lineBackground ${d.line}`;
  }
}

function int(o: Json, key: string): number {
  const v = o[key];
  if (typeof v !== 'number') throw new Error(`missing int ${key}`);
  return v;
}

function string(o: Json, key: string): string {
  const v = o[key];
  if (typeof v !== 'string') throw new Error(`missing string ${key}`);
  return v;
}

function bool(o: Json, key: string, fallback: boolean): boolean {
  const v = o[key];
  return typeof v === 'boolean' ? v : fallback;
}

for (const file of files) {
  const { cases } = JSON.parse(readFileSync(join(ROOT, 'tests/vectors', file), 'utf8')) as {
    cases: Json[];
  };
  describe(file, () => {
    for (const c of cases) {
      const name = c.name as string;
      // A pending case pins behavior the engine does not have yet.
      const pending = typeof c.pending === 'string' && c.pending.length > 0;
      (dir && !pending ? test : test.skip)(name, () => {
        const runner = new VectorRunner(c);
        try {
          runner.run();
        } finally {
          runner.close();
        }
      });
    }
  });
}

const javascript = join(ROOT, 'languages/javascript/web/javascript.wasm');
if (dir && !existsSync(javascript))
  console.warn('javascript grammar not built, run yarn build:web-grammars');

(dir && existsSync(javascript) ? test : test.skip)(
  'closing an editor mid-parse leaves no live snapshot',
  () => {
    pumpAll(m);
    const slots = m._cpw_test_slots();
    loadGrammar(m, javascript, 'javascript', join(ROOT, 'languages/javascript/queries/javascript'));
    const js10k = readFileSync(join(ROOT, 'tests/highlight/javascript.txt'), 'utf8').repeat(15);
    const core = new EditorCore(m, 'let a = 1;\n', 1000);
    expect(core.setLanguage('javascript')).toBe(true);
    pumpAll(m);
    expect(core.snapshot).not.toBe(0);
    core.setText(js10k);
    m._cpw_pump(1, 0);
    expect(m._cpw_pump(0, 0)).toBeGreaterThan(0);
    core.close();
    pumpAll(m);
    expect(m._cpw_test_held_snapshots()).toBe(0);
    expect(m._cpw_test_slots()).toBe(slots);
  },
);
