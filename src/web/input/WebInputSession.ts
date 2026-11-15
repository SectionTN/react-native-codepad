import type { EditorCore } from '../core/EditorCore';
import { windowAround } from './window';

// What the keyboard's textarea holds: its value and its selection, in textarea units.
export type TextareaState = { value: string; start: number; end: number };
export type InputLike = { inputType: string; data: string | null; isComposing: boolean };
type Range = { start: number; end: number };

const codePoints = (s: string) => [...s].length;
// Input that auto-closes and indents as typing does. A paste or a replacement goes in as written.
const TYPED = new Set(['insertText', 'insertLineBreak', 'insertParagraph']);

// The web twin of ImeSession: maps a textarea holding a window of the document onto the core.
export class WebInputSession {
  private win = { start: 0, value: '', line: 0 };
  private before: Range | null = null;
  private composed: Range | null = null;
  // The textarea state sync last handed out.
  private written: TextareaState | null = null;

  constructor(
    private readonly core: EditorCore,
    private readonly apply: (edit: () => void) => void,
  ) {}

  get windowStart(): number {
    return this.win.start;
  }

  // The document range the keyboard is composing, drawn underlined.
  get composing(): Range | null {
    return this.composed ? { ...this.composed } : null;
  }

  // The window around the core's selection, to write into the textarea. Null while composing.
  sync(): TextareaState | null {
    if (this.composed) return null;
    const { start, end } = windowAround(this.core);
    const { anchor, head } = this.core.selection;
    this.win = { start, value: this.core.text(start, end), line: this.core.lineAt(head) };
    // A selection longer than the window shows as the whole window selected.
    const clamp = (offset: number) => Math.min(Math.max(offset - start, 0), end - start);
    this.written = {
      value: this.win.value,
      start: clamp(Math.min(anchor, head)),
      end: clamp(Math.max(anchor, head)),
    };
    return { ...this.written };
  }

  // The selection the edit replaces, which a diff alone cannot place (Enter before a newline).
  beforeInput(ta: TextareaState): void {
    this.before = { start: ta.start, end: ta.end };
  }

  input(e: InputLike, ta: TextareaState): TextareaState | null {
    this.written = null;
    const typing = TYPED.has(e.inputType);
    let grown = false;
    const old = this.win.value;
    const next = ta.value;
    const ws = this.win.start;
    const sel = this.before ?? { start: ta.start, end: ta.start };
    this.before = null;
    let p = 0;
    const pMax = Math.min(sel.start, ta.start, old.length, next.length);
    while (p < pMax && old.charCodeAt(p) === next.charCodeAt(p)) p++;
    let s = 0;
    const sMax = Math.min(old.length - Math.max(sel.end, p), next.length - Math.max(ta.end, p));
    while (s < sMax && old.charCodeAt(old.length - 1 - s) === next.charCodeAt(next.length - 1 - s))
      s++;
    let start = ws + p;
    let end = ws + old.length - s;
    const inserted = next.slice(p, next.length - s);
    const { anchor, head } = this.core.selection;
    const selStart = Math.min(anchor, head);
    const selEnd = Math.max(anchor, head);
    const winEnd = ws + old.length;
    // A selection longer than the window goes whole, though the textarea held only its middle.
    if (
      selEnd > selStart &&
      (selStart < ws || selEnd > winEnd) &&
      start <= Math.max(selStart, ws) &&
      end >= Math.min(selEnd, winEnd)
    ) {
      start = Math.min(start, selStart);
      grown = true;
      end = Math.max(end, selEnd);
    }
    const composing = this.composed !== null || e.isComposing;
    const lengthBefore = this.core.length;
    let coreCaret = false;
    this.apply(() => {
      const removed = this.core.text(start, end);
      if (composing) {
        this.core.inputReplace(start, end, inserted);
        if (this.composed) this.composed = { start, end: start + inserted.length };
        this.select(start + inserted.length, start + inserted.length);
        coreCaret = true;
      } else if (typing && start === end && inserted === '\n') {
        this.select(start, start);
        this.core.insertNewline();
        coreCaret = true;
      } else if (typing && start === end && codePoints(inserted) === 1) {
        this.select(start, start);
        this.core.typeText(inserted);
        coreCaret = true;
      } else if (
        inserted === '' &&
        codePoints(removed) === 1 &&
        selStart === selEnd &&
        end === selEnd &&
        this.core.deletesPair(end)
      ) {
        this.core.inputReplace(start, end + 1, '', true);
        coreCaret = true;
      } else if (start !== end || inserted !== '') {
        this.core.inputReplace(start, end, inserted, inserted === '' && codePoints(removed) === 1);
      }
      const caret = start + inserted.length;
      if (grown) this.select(caret, caret);
      else if (!coreCaret) this.select(ws + ta.start, ws + ta.end);
    });
    const coreWindow = this.core.text(ws, winEnd + this.core.length - lengthBefore);
    const caret = this.core.selection;
    const mirrors =
      coreWindow === next &&
      Math.min(caret.anchor, caret.head) === ws + ta.start &&
      Math.max(caret.anchor, caret.head) === ws + ta.end;
    if (composing) {
      this.win.value = next;
      return null;
    }
    if (!mirrors) return this.sync();
    this.win.value = next;
    return this.core.lineAt(caret.head) !== this.win.line ? this.sync() : null;
  }

  compositionStart(ta: TextareaState): void {
    const ws = this.win.start;
    this.composed = { start: ws + ta.start, end: ws + ta.end };
    this.core.beginGroup();
  }

  // The window stays as the textarea shows it, since a browser may still send the composition's last input.
  compositionEnd(): void {
    this.finishComposition();
  }

  // After compositionend has settled: a new window when the caret left the window's middle line.
  settle(ta: TextareaState): TextareaState | null {
    return this.composed ? null : this.follow(ta);
  }

  // The user moved the caret, ignored while composing and for the echo of what sync wrote.
  selectionChange(ta: TextareaState): TextareaState | null {
    if (this.composed || ta.value !== this.win.value) return null;
    const w = this.written;
    if (w && ta.value === w.value && ta.start === w.start && ta.end === w.end) return null;
    const ws = this.win.start;
    this.written = null;
    this.apply(() => this.select(ws + ta.start, ws + ta.end));
    return this.follow(ta);
  }

  // The core is about to change from outside the keyboard: the composition ends first, so the edit undoes alone.
  external(): void {
    this.finishComposition();
  }

  finishComposition(): void {
    if (!this.composed) return;
    this.composed = null;
    this.core.endGroup();
  }

  // A new window once the head left the window's middle line or the core no longer matches the textarea.
  private follow(ta: TextareaState): TextareaState | null {
    const ws = this.win.start;
    const head = this.core.selection.head;
    const same = this.core.text(ws, ws + ta.value.length) === ta.value;
    return !same || this.core.lineAt(head) !== this.win.line ? this.sync() : null;
  }

  private select(anchor: number, head: number): void {
    const s = this.core.selection;
    if (s.anchor !== anchor || s.head !== head) this.core.setSelection(anchor, head);
  }
}
