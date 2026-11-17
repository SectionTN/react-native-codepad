import type { Decoration } from '../../types';
import { type CoreModule, type Heap, heapOf, withCString } from './module';

export type Selection = { anchor: number; head: number };
export type Position = { line: number; column: number };
export type SearchHit = { index: number; total: number };
export type SearchQuery = {
  text: string;
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
};
export type EditorSettings = {
  tabSize: number;
  insertSpaces: boolean;
  autoIndent: boolean;
  autoCloseBrackets: boolean;
};
export type ChangeOrigin = 'input' | 'api' | 'undo' | 'redo';
export type MoveUnit = 'char' | 'word' | 'lineStart' | 'lineEnd' | 'docStart' | 'docEnd';
export type WebChange = {
  start: number;
  removedLength: number;
  insertedLength: number;
  revision: number;
  origin: ChangeOrigin;
  removed: string;
  inserted: string;
};

export class SearchError extends Error {}

// The engine's parse budget per slice, so the page's pump stays inside a frame.
export const DEFAULT_BUDGET_MICROS = 3000;

const ORIGINS: ChangeOrigin[] = ['input', 'api', 'undo', 'redo'];
const MOVES: MoveUnit[] = ['char', 'word', 'lineStart', 'lineEnd', 'docStart', 'docEnd'];
const Command = {
  Newline: 0,
  Tab: 1,
  ShiftTab: 2,
  Indent: 3,
  Outdent: 4,
  Backspace: 5,
  Delete: 6,
  Undo: 7,
  Redo: 8,
  SelectAll: 9,
} as const;
const Kind = { Underline: 0, Gap: 1, LineBackground: 2 } as const;
const SEARCH_REGEX = 1;
const SEARCH_CASE = 2;
const SEARCH_WORD = 4;

// The editing state behind one editor, held by the core in the module's heap: document, selection, history and
// settings. The web twin of ios/Codepad/core/EditorCore.swift.
export class EditorCore {
  readonly index: number;
  readonly handle: number;
  private readonly heap: Heap;
  private payloads: Decoration[] = [];
  private cachedVersion = -1;
  private cached: Decoration[] = [];
  private current: EditorSettings = {
    tabSize: 4,
    insertSpaces: true,
    autoIndent: true,
    autoCloseBrackets: true,
  };
  private closed = false;

  constructor(
    readonly m: CoreModule,
    text = '',
    budgetMicros = DEFAULT_BUDGET_MICROS,
  ) {
    this.heap = heapOf(m);
    this.index = m._cpw_open(this.heap.units(text), text.length, BigInt(budgetMicros));
    this.handle = m._cpw_editor(this.index);
    this.pushSettings();
  }

  get settings(): EditorSettings {
    return { ...this.current };
  }

  set settings(s: EditorSettings) {
    this.current = { ...s };
    this.pushSettings();
  }

  get selection(): Selection {
    const packed = this.m._cp_editor_selection(this.handle);
    return {
      anchor: Number(BigInt.asIntN(32, packed >> 32n)),
      head: Number(BigInt.asIntN(32, packed)),
    };
  }

  get canUndo(): boolean {
    return (this.m._cp_editor_history(this.handle) & 1) !== 0;
  }

  get canRedo(): boolean {
    return (this.m._cp_editor_history(this.handle) & 2) !== 0;
  }

  get length(): number {
    return this.m._cp_doc_length(this.handle) >>> 0;
  }

  get lineCount(): number {
    return this.m._cp_doc_line_count(this.handle);
  }

  get revision(): number {
    return this.m._cp_doc_revision(this.handle);
  }

  lineStart(line: number): number {
    return this.m._cp_doc_line_start(this.handle, line) >>> 0;
  }

  lineEnd(line: number): number {
    return this.m._cp_doc_line_end(this.handle, line) >>> 0;
  }

  lineAt(offset: number): number {
    return this.m._cp_doc_line_at(this.handle, clampUnsigned(offset));
  }

  // The text of [start, end), clamped to the document.
  text(start = 0, end = this.length): string {
    const length = this.length;
    const s = Math.min(Math.max(0, start), length);
    const e = Math.min(Math.max(s, end), length);
    const out = this.heap.output((e - s) * 2);
    const n = this.m._cp_doc_copy(this.handle, s, e, out, e - s) >>> 0;
    return this.heap.readUnits(out, n);
  }

  // The line's text without its newline, empty outside the document.
  line(index: number): string {
    if (index < 0 || index >= this.lineCount) return '';
    return this.text(this.lineStart(index), this.lineEnd(index));
  }

  offsetToPosition(offset: number): Position {
    const out = this.heap.output(8);
    this.m._cp_doc_position(out, this.handle, clampUnsigned(offset));
    const p = this.heap.readInts(out, 2);
    return { line: p[0] as number, column: p[1] as number };
  }

  positionToOffset(line: number, column: number): number {
    return this.m._cp_doc_offset(this.handle, line, column) >>> 0;
  }

  replace(start: number, end: number, text: string, origin: ChangeOrigin = 'api'): void {
    this.applyChange(start, end, text, origin, false, false);
  }

  // Every mutation goes through here. typing marks single key input that may coalesce in the history.
  // caretAfter puts a collapsed caret after the inserted text instead of mapping the selection.
  applyChange(
    start: number,
    end: number,
    text: string,
    origin: ChangeOrigin,
    typing: boolean,
    caretAfter: boolean,
  ): void {
    this.m._cp_editor_replace(
      this.handle,
      clampUnsigned(start),
      clampUnsigned(end),
      this.heap.units(text),
      text.length,
      ORIGINS.indexOf(origin),
      typing ? 1 : 0,
      caretAfter ? 1 : 0,
    );
  }

  insertText(text: string, origin: ChangeOrigin = 'api'): void {
    this.m._cp_editor_insert(
      this.handle,
      this.heap.units(text),
      text.length,
      ORIGINS.indexOf(origin),
    );
  }

  // A keyboard edit. The selection maps through the change like any edit.
  inputReplace(start: number, end: number, text: string, typing = false): void {
    this.applyChange(start, end, text, 'input', typing, false);
  }

  setText(text: string, keepHistory = false): void {
    this.m._cp_editor_set_text(
      this.handle,
      this.heap.units(text),
      text.length,
      keepHistory ? 1 : 0,
    );
  }

  // revision is the document revision the items were computed for, below zero for the current one. False when the
  // edits since then are no longer known, which keeps the current set.
  setDecorations(items: Decoration[], revision: number): boolean {
    const kept: Decoration[] = [];
    const raw: number[] = [];
    for (const d of items) {
      if (d.kind === 'underline') {
        // A thickness of zero or less would never advance the wave.
        if ((d.thickness ?? 1) <= 0) continue;
        raw.push(Kind.Underline, d.range.start, d.range.end, kept.length);
      } else if (d.kind === 'gap') {
        raw.push(Kind.Gap, d.line, d.rows, kept.length);
      } else {
        raw.push(Kind.LineBackground, d.line, 0, kept.length);
      }
      kept.push(d);
    }
    const ptr = this.heap.ints32(raw.length);
    this.m.HEAP32.set(raw, ptr >> 2);
    const accepted =
      this.m._cp_editor_set_decorations(this.handle, ptr, kept.length, revision) !== 0;
    if (accepted) this.payloads = kept;
    return accepted;
  }

  get decorationsVersion(): number {
    return this.m._cp_editor_decorations_version(this.handle);
  }

  // The decorations in current document coordinates, mapped by the core through every edit.
  decorations(): Decoration[] {
    const version = this.decorationsVersion;
    if (version === this.cachedVersion) return this.cached;
    const count = this.m._cp_editor_decorations(this.handle, 0, 0) >>> 0;
    const out = this.heap.output(count * 16);
    this.m._cp_editor_decorations(this.handle, out, count);
    const raw = this.heap.readInts(out, count * 4);
    const items: Decoration[] = [];
    for (let i = 0; i < count; i++) {
      const a = raw[i * 4 + 1] as number;
      const b = raw[i * 4 + 2] as number;
      const d = this.payloads[raw[i * 4 + 3] as number];
      if (!d) continue;
      if (d.kind === 'underline') items.push({ ...d, range: { start: a, end: b } });
      else if (d.kind === 'gap') items.push({ kind: 'gap', line: a, rows: b });
      else items.push({ ...d, line: a });
    }
    this.cached = items;
    this.cachedVersion = version;
    return items;
  }

  // Total gap rows per line, lines with a gap only.
  gapRows(): Map<number, number> {
    const out = new Map<number, number>();
    for (const d of this.decorations()) {
      if (d.kind === 'gap') out.set(d.line, (out.get(d.line) ?? 0) + d.rows);
    }
    return out;
  }

  typeText(text: string): void {
    this.m._cp_editor_type(this.handle, this.heap.units(text), text.length);
  }

  insertNewline(): void {
    this.command(Command.Newline);
  }
  tab(): void {
    this.command(Command.Tab);
  }
  shiftTab(): void {
    this.command(Command.ShiftTab);
  }
  indent(): void {
    this.command(Command.Indent);
  }
  outdent(): void {
    this.command(Command.Outdent);
  }
  backspace(): void {
    this.command(Command.Backspace);
  }
  delete(): void {
    this.command(Command.Delete);
  }
  selectAll(): void {
    this.command(Command.SelectAll);
  }
  undo(): boolean {
    return this.command(Command.Undo);
  }
  redo(): boolean {
    return this.command(Command.Redo);
  }

  setSelection(anchor: number, head: number): void {
    this.m._cp_editor_set_selection(this.handle, clampInt(anchor), clampInt(head));
  }

  // Edits between beginGroup and endGroup undo as one step, as a keyboard's composed word does.
  beginGroup(): void {
    this.m._cp_editor_begin_group(this.handle);
  }
  endGroup(): void {
    this.m._cp_editor_end_group(this.handle);
  }

  // True when a backspace at caret would take an auto-closed pair, like the caret between ( and ).
  deletesPair(caret: number): boolean {
    return this.m._cp_editor_deletes_pair(this.handle, clampUnsigned(caret)) !== 0;
  }

  move(unit: MoveUnit, forward: boolean, extend: boolean): void {
    this.m._cp_editor_move(this.handle, MOVES.indexOf(unit), forward ? 1 : 0, extend ? 1 : 0);
  }

  selectWordAt(offset: number): void {
    this.m._cp_editor_select_word_at(this.handle, clampUnsigned(offset));
  }

  // The bracket at the caret and its partner. A snapshot at the document's revision skips strings and comments.
  bracketMatch(snapshot: number): [number, number] | null {
    const out = this.heap.output(8);
    if (
      this.m._cp_editor_bracket_match(
        this.handle,
        snapshot,
        clampUnsigned(this.selection.head),
        out,
      ) === 0
    ) {
      return null;
    }
    const pair = this.heap.readInts(out, 2);
    return [pair[0] as number, pair[1] as number];
  }

  get searchActive(): boolean {
    return this.m._cp_editor_search_active(this.handle) !== 0;
  }

  // An invalid regex throws before any state changes, except that it clears the search.
  setSearch(query: SearchQuery): void {
    let flags = 0;
    if (query.regex) flags |= SEARCH_REGEX;
    if (query.caseSensitive) flags |= SEARCH_CASE;
    if (query.wholeWord) flags |= SEARCH_WORD;
    const error = this.heap.output(512);
    const ok = this.m._cp_editor_set_search(
      this.handle,
      this.heap.units(query.text),
      query.text.length,
      flags,
      error,
      512,
    );
    if (ok === 0) throw new SearchError(this.m.UTF8ToString(error, 512));
  }

  clearSearch(): void {
    this.m._cp_editor_clear_search(this.handle);
  }

  // Computes the matches when they are stale.
  ensureMatches(): void {
    this.m._cp_editor_matches(this.handle, 0, 0);
  }

  // The matches as start and end pairs, computed when stale.
  get matches(): number[] {
    const count = this.m._cp_editor_matches(this.handle, 0, 0) >>> 0;
    if (count === 0) return [];
    const out = this.heap.output(count * 4);
    this.m._cp_editor_matches(this.handle, out, count);
    return Array.from(this.heap.readInts(out, count));
  }

  get matchCount(): number {
    return this.m._cp_editor_match_count(this.handle);
  }

  // True when a match attempt hit PCRE2's match limit, so the matches stop there.
  get matchLimited(): boolean {
    return this.m._cp_editor_match_limited(this.handle) !== 0;
  }

  get searchStale(): boolean {
    return this.m._cp_editor_search_stale(this.handle) !== 0;
  }

  findNext(): SearchHit | null {
    return this.find(true);
  }

  findPrevious(): SearchHit | null {
    return this.find(false);
  }

  replaceCurrent(text: string): boolean {
    return this.m._cp_editor_replace_current(this.handle, this.heap.units(text), text.length) !== 0;
  }

  replaceAll(text: string): number {
    return this.m._cp_editor_replace_all(this.handle, this.heap.units(text), text.length);
  }

  // A language id the page has not loaded clears the language, so the editor draws plain text.
  setLanguage(id: string): boolean {
    return withCString(this.m, id, (ptr) => this.m._cpw_set_language(this.index, ptr)) !== 0;
  }

  // The latest snapshot, or 0 before the first parse.
  get snapshot(): number {
    return this.m._cpw_snapshot(this.index);
  }

  get snapshotCount(): number {
    return this.m._cpw_snapshot_count(this.index);
  }

  // The injection names that found no language since the last call, so the page can load them.
  takeMissedLanguages(): string[] {
    for (let cap = 256; ; ) {
      const out = this.m._malloc(cap);
      const size = this.m._cpw_take_missed(this.index, out, cap);
      const joined = size > 0 && size <= cap ? this.m.UTF8ToString(out, size) : '';
      this.m._free(out);
      if (size <= cap) return joined ? joined.split('\n') : [];
      cap = size;
    }
  }

  // Looks the missing injection names up again and repaints, after a language they may name registered.
  refreshInjections(): void {
    this.m._cpw_refresh(this.index);
  }

  // Pins the history clock to millis, for tests and recordings. Below zero follows the page clock.
  setClock(millis: number): void {
    this.m._cpw_set_clock(this.index, millis);
  }

  // The changes since the last call, oldest first.
  takeChanges(): WebChange[] {
    const m = this.m;
    const lenPtr = this.heap.output(4);
    const needed = m._cpw_take_changes(this.index, 0, 0, 0, 0, lenPtr) >>> 0;
    if (needed === 0) return [];
    const units = m.HEAP32[lenPtr >> 2] as number;
    const ints = m._malloc(needed * 4);
    const text = m._malloc(Math.max(2, units * 2));
    try {
      m._cpw_take_changes(this.index, ints, needed, text, units, lenPtr);
      const raw = this.heap.readInts(ints, needed);
      const out: WebChange[] = [];
      for (let i = 0; i < needed; i += 7) {
        const removedLength = raw[i + 1] as number;
        const insertedLength = raw[i + 2] as number;
        out.push({
          start: raw[i] as number,
          removedLength,
          insertedLength,
          revision: raw[i + 3] as number,
          origin: ORIGINS[raw[i + 4] as number] ?? 'api',
          removed: this.heap.readUnits(text + (raw[i + 5] as number) * 2, removedLength),
          inserted: this.heap.readUnits(text + (raw[i + 6] as number) * 2, insertedLength),
        });
      }
      return out;
    } finally {
      m._free(ints);
      m._free(text);
    }
  }

  // Frees the editor now. Its engine frees itself in later pumps.
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.m._cpw_close(this.index);
  }

  private find(forward: boolean): SearchHit | null {
    const out = this.heap.output(8);
    if (this.m._cp_editor_find(this.handle, forward ? 1 : 0, out, out + 4) === 0) return null;
    const hit = this.heap.readInts(out, 2);
    return { index: hit[0] as number, total: hit[1] as number };
  }

  private command(command: number): boolean {
    return this.m._cp_editor_command(this.handle, command) !== 0;
  }

  private pushSettings(): void {
    const s = this.current;
    const ptr = this.heap.ints32(4);
    this.m.HEAP32.set(
      [s.tabSize, s.insertSpaces ? 1 : 0, s.autoIndent ? 1 : 0, s.autoCloseBrackets ? 1 : 0],
      ptr >> 2,
    );
    this.m._cp_editor_set_settings(this.handle, ptr);
  }
}

function clampUnsigned(n: number): number {
  return Math.min(Math.max(0, Math.trunc(n)), 0xffffffff);
}

function clampInt(n: number): number {
  return Math.min(Math.max(Math.trunc(n), -0x80000000), 0x7fffffff);
}
