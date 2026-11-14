import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { builtCore, loadCore, ROOT } from '../../../tests/web/core';
import { EditorCore } from '../core/EditorCore';
import { type TextareaState, WebInputSession } from '../input/WebInputSession';

type Event = {
  type: string;
  inputType?: string;
  data?: string | null;
  isComposing: boolean;
  windowStart: number;
  ta: TextareaState;
};
type Recording = {
  settings: { autoCloseBrackets: boolean; autoIndent: boolean };
  initial: { text: string; selection: [number, number] };
  events: Event[];
  expected: { text: string };
};

const dir = builtCore('lib/web', 'yarn build:web');
const folder = join(ROOT, 'tests/ime-web');
const files = existsSync(folder)
  ? readdirSync(folder)
      .filter((f) => f.endsWith('.json'))
      .sort()
  : [];
if (files.length === 0) console.warn('tests/ime-web holds no recording');

const state = (ta: TextareaState): TextareaState => ({
  value: ta.value,
  start: ta.start,
  end: ta.end,
});

// Replays what a browser keyboard did into a recorded textarea and checks the core after every edit.
for (const file of files) {
  (dir ? test : test.skip)(file.replace(/\.json$/, ''), async () => {
    const r = JSON.parse(readFileSync(join(folder, file), 'utf8')) as Recording;
    const core = new EditorCore(await loadCore(dir as string), r.initial.text);
    core.settings = { ...core.settings, ...r.settings };
    core.setSelection(r.initial.selection[0], r.initial.selection[1]);
    const session = new WebInputSession(core, (edit) => edit());
    let model = r.initial.text;
    let value = '';
    let first = true;
    // The textarea state the session asked the page to write, until the recording shows the page writing it.
    let pending: TextareaState | null = null;
    for (const [i, e] of r.events.entries()) {
      const at = `event ${i} ${e.type} ${e.inputType ?? ''}`;
      if (e.type === 'sync') {
        const got = first ? session.sync() : pending;
        expect({ at, got, windowStart: session.windowStart }).toEqual({
          at,
          got: state(e.ta),
          windowStart: e.windowStart,
        });
        first = false;
        pending = null;
        value = e.ta.value;
      } else if (e.type === 'beforeinput') {
        session.beforeInput(e.ta);
      } else if (e.type === 'input') {
        expect({ at, unwritten: pending }).toEqual({ at, unwritten: null });
        pending = session.input(
          { inputType: e.inputType ?? '', data: e.data ?? null, isComposing: e.isComposing },
          e.ta,
        );
        model =
          model.slice(0, e.windowStart) + e.ta.value + model.slice(e.windowStart + value.length);
        value = e.ta.value;
        expect({ at, text: core.text() }).toEqual({ at, text: model });
        if (e.isComposing) {
          const c = session.composing;
          if (e.inputType === 'insertCompositionText')
            expect({ at, composed: c && core.text(c.start, c.end) }).toEqual({
              at,
              composed: e.data,
            });
        } else {
          const { anchor, head } = core.selection;
          expect({ at, selection: [Math.min(anchor, head), Math.max(anchor, head)] }).toEqual({
            at,
            selection: [e.windowStart + e.ta.start, e.windowStart + e.ta.end],
          });
        }
      } else if (e.type === 'compositionstart') {
        session.compositionStart(e.ta);
      } else if (e.type === 'compositionend') {
        pending = session.compositionEnd(e.ta) ?? pending;
      } else if (e.type === 'selectionchange') {
        pending = session.selectionChange(e.ta) ?? pending;
      } else if (e.type === 'blur') {
        session.finishComposition();
      }
    }
    expect(core.text()).toBe(r.expected.text);
    core.close();
  });
}
