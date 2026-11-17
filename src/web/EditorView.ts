/// <reference lib="dom" />
import { githubLight } from '../themes/githubLight';
import type { CaretDirection, ContentInsets, Decoration, Rect, Suggestions, Theme } from '../types';
import { EditorCore, type MoveUnit, type WebChange } from './core/EditorCore';
import { Layout } from './core/Layout';
import type { CoreModule } from './core/module';
import { measureBaseline, solidTop, waveAmplitude, wavePath } from './decorations';
import { type DecodedFrame, decodeFrame } from './frame';
import { CaretMover, type LineGeometry } from './input/CaretMover';
import { InputHost } from './input/InputHost';
import { overlapOf, watchViewport } from './input/keyboardInset';
import { keyCommand } from './input/keys';
import { WebInputSession } from './input/WebInputSession';
import { ensureInjected, ensureLanguage, onRegistered } from './loader';
import { probeKey, probing, registerView, requestPump } from './pump';
import { type CssTheme, cssTheme } from './theme';

export type ViewOptions = {
  theme: Theme;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  lineNumbers: boolean;
  softWrap: boolean;
  highlightActiveLine: boolean;
  matchBrackets: boolean;
  textPadding: number;
  contentInsets: ContentInsets;
  scrollEnabled: boolean;
  placeholder: string;
  readOnly: boolean;
  tabSize: number;
  insertSpaces: boolean;
  autoIndent: boolean;
  autoCloseBrackets: boolean;
  onContentSize?: (width: number, height: number) => void;
  onScroll?: (x: number, y: number, contentWidth: number, contentHeight: number) => void;
  onFirstDraw?: () => void;
  onChange?: (change: WebChange) => void;
  onSelection?: (anchor: number, head: number, revision: number) => void;
  suggestions: Suggestions;
  autoFocus: boolean;
  avoidKeyboard: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onGapLayout?: (gaps: GapRect[]) => void;
};

export type GapRect = { line: number; rect: Rect };

// The defaults of website/docs/reference/props.md.
export const DEFAULT_OPTIONS: ViewOptions = {
  theme: githubLight,
  fontFamily: '',
  fontSize: 14,
  lineHeight: 1.4,
  lineNumbers: true,
  softWrap: false,
  highlightActiveLine: true,
  matchBrackets: true,
  textPadding: 8,
  contentInsets: {},
  scrollEnabled: true,
  placeholder: '',
  readOnly: false,
  tabSize: 4,
  insertSpaces: true,
  autoIndent: true,
  autoCloseBrackets: true,
  suggestions: 'off',
  autoFocus: false,
  avoidKeyboard: false,
};

const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const SNAPSHOT_INFO_INTS = 7;
const SVG = 'http://www.w3.org/2000/svg';
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
// A run of Hebrew or Arabic script anywhere in a row.
const RTL_TEXT = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const MOVES: Partial<Record<CaretDirection, [MoveUnit, boolean]>> = {
  left: ['char', false],
  right: ['char', true],
  wordLeft: ['word', false],
  wordRight: ['word', true],
  lineStart: ['lineStart', false],
  lineEnd: ['lineEnd', true],
  documentStart: ['docStart', false],
  documentEnd: ['docEnd', true],
};

type Entry = {
  el: HTMLDivElement;
  revision: number;
  spans: Int32Array | null;
  text: string;
  // Edited since its last draw: the element is reused, but the frame reads the line again.
  stale?: boolean;
};

// The edited line's previous spans moved along an edit that stayed inside it, kept until a parse lands.
type Kept = { line: number; revision: number; spans: Int32Array | null; tail: Int32Array | null };

// One editor drawn as DOM lines from the core, outside React's render. The web twin of CodeEditorView.swift.
export class EditorView {
  readonly core: EditorCore;
  readonly layout: Layout;
  private readonly m: CoreModule;
  private o: ViewOptions = DEFAULT_OPTIONS;
  private css: CssTheme = cssTheme(githubLight);
  private readonly root: HTMLDivElement;
  private readonly scroller: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private readonly gutter: HTMLDivElement;
  private readonly textLayer: HTMLDivElement;
  private readonly activeLine: HTMLDivElement;
  private readonly placeholderEl: HTMLDivElement;
  private readonly unregister: () => void;
  private readonly resize: ResizeObserver | null;
  private readonly cache = new Map<number, Entry>();
  private readonly attached = new Set<number>();
  private readonly gutterLines = new Map<number, HTMLDivElement>();
  private kept: Kept | null = null;
  private language = '';
  private languageReady = false;
  private appliedRevision = -1;
  private drawnSnapshot = 0;
  private seenSnapshots = 0;
  private dirty = true;
  private destroyed = false;
  // The next frame parses before it draws: the lines on screen lost colors an edit could not keep, or none came yet.
  urgent = false;
  private drawn = false;
  private rowHeight = 0;
  private charWidth = 0;
  private lastContent = { width: -1, height: -1 };
  private lastScroll = { x: 0, y: 0 };
  private lastSelection = { anchor: 0, head: 0 };
  private frameInts = 0;
  private frameIntsCap = 0;
  private frameText = 0;
  private frameTextCap = 0;
  private readonly onScrollEvent = () => this.invalidate();
  private offViewport: () => void = () => {};
  // The keyboard's overlap with the editor, part of the bottom inset under avoidKeyboard.
  private keyboard = 0;
  // Injection names the engine found no language for, and the ids this view already refreshed after.
  private readonly missed = new Set<string>();
  private readonly refreshedFor = new Set<string>();
  private readonly offRegistered = onRegistered(() => {
    if (this.missed.size) this.loadMissed();
  });
  readonly session: WebInputSession;
  private readonly input: InputHost;
  // The app's line backgrounds over the active line, and its underlines under the text.
  private readonly lineBackgroundLayer = div('position:absolute;left:0;top:0;pointer-events:none;');
  private readonly underlineLayer = div('position:absolute;left:0;top:0;pointer-events:none;');
  private decorationsKey = '';
  private baseline = 0;
  private drawnWindow = { first: 0, last: -1 };
  private drawnGaps: GapRect[] = [];
  private reportedGaps = '[]';
  private readonly selectionLayer = div('position:absolute;left:0;top:0;pointer-events:none;');
  private readonly composingLayer = div(
    'position:absolute;left:0;top:0;z-index:1;pointer-events:none;',
  );
  private readonly caretEl = div(
    'position:absolute;width:2px;z-index:1;pointer-events:none;display:none;animation:codepad-blink 1s steps(1) infinite;',
  );
  private inputting = false;
  private readonly mover = new CaretMover();
  private movingVertically = false;
  // The caret scrolls into view on the next draw, before the page paints.
  private revealing = false;
  // The caret as the last frame measured it, null while its line is not drawn.
  private drawnCaret: Rect | null = null;
  // The row of the drawn caret inside its wrapped line.
  private drawnCaretRow = 0;
  // Hidden copies of lines a caret move measured, dropped on the next draw.
  private readonly measuring = new Map<number, { el: HTMLDivElement; text: string }>();
  private readonly geometry: LineGeometry = {
    rows: (line) => Math.max(1, Math.round(this.lineEl(line).offsetHeight / this.rowHeight)),
    rowOf: (line, column) =>
      Math.min(this.pointIn(this.lineEl(line), column).row, this.geometry.rows(line) - 1),
    caretX: (line, column) => this.pointIn(this.lineEl(line), column).x,
    columnAt: (line, row, x) => this.columnAt(line, row, x),
  };
  private readonly onClickEvent = (e: MouseEvent) => this.click(e);
  // A press on the text or the line numbers keeps the focus, so a click in a focused editor never blurs it.
  private readonly onMouseDownEvent = (e: MouseEvent) => {
    const target = e.target as Node;
    const inside = this.textLayer.contains(target) || this.gutter.contains(target);
    if (e.button === 0 && inside) e.preventDefault();
  };

  constructor(host: HTMLElement, m: CoreModule, text = '') {
    this.m = m;
    this.core = new EditorCore(m, text);
    this.layout = new Layout(this.core);
    this.root = div('position:relative;overflow:hidden;width:100%;height:100%;direction:ltr;');
    this.scroller = div('position:absolute;inset:0;overflow:auto;');
    this.scroller.dataset.scroller = '';
    this.content = div('position:relative;');
    this.gutter = div('position:sticky;left:0;top:0;z-index:2;');
    this.textLayer = div('position:absolute;left:0;top:0;width:100%;height:100%;');
    this.activeLine = div('position:absolute;left:0;display:none;');
    this.placeholderEl = div('position:absolute;white-space:pre;display:none;pointer-events:none;');
    this.textLayer.append(
      this.activeLine,
      this.lineBackgroundLayer,
      this.selectionLayer,
      this.underlineLayer,
      this.placeholderEl,
      this.composingLayer,
      this.caretEl,
    );
    this.textLayer.style.userSelect = 'none';
    this.textLayer.style.webkitUserSelect = 'none';
    this.caretEl.dataset.caret = '';
    this.selectionLayer.dataset.selection = '';
    this.activeLine.dataset.activeLine = '';
    this.session = new WebInputSession(this.core, (edit) => this.applyInput(edit));
    this.input = new InputHost(this.root, this.session, {
      keyDown: (e) => this.keyDown(e),
      clipboard: (cut) => this.clipboard(cut),
      focusChanged: (focused) => {
        this.safely(() => (focused ? this.o.onFocus?.() : this.o.onBlur?.()));
        this.invalidate();
      },
      changed: () => this.invalidate(),
    });
    this.scroller.addEventListener('click', this.onClickEvent);
    this.scroller.addEventListener('mousedown', this.onMouseDownEvent);
    blinkStyle();
    this.content.append(this.gutter, this.textLayer);
    this.scroller.append(this.content);
    this.root.append(this.scroller);
    host.append(this.root);
    this.scroller.addEventListener('scroll', this.onScrollEvent, { passive: true });
    this.resize =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.invalidate());
    this.resize?.observe(this.scroller);
    document.fonts?.ready.then(() => this.remeasure());
    document.fonts?.addEventListener?.('loadingdone', this.remeasureEvent);
    this.lastSelection = this.core.selection;
    this.applyOptions(true);
    this.unregister = registerView(this);
  }

  setOptions(next: Partial<ViewOptions>): void {
    if (this.destroyed) return;
    const before = this.o;
    this.o = { ...this.o, ...next };
    const metrics =
      before.fontFamily !== this.o.fontFamily ||
      before.fontSize !== this.o.fontSize ||
      before.lineHeight !== this.o.lineHeight ||
      before.tabSize !== this.o.tabSize ||
      before.softWrap !== this.o.softWrap;
    const looks =
      metrics ||
      before.theme !== this.o.theme ||
      before.lineNumbers !== this.o.lineNumbers ||
      before.scrollEnabled !== this.o.scrollEnabled;
    if (before.scrollEnabled !== this.o.scrollEnabled) this.listenToPage(!this.o.scrollEnabled);
    if (before.avoidKeyboard !== this.o.avoidKeyboard) {
      this.offViewport();
      this.offViewport = this.o.avoidKeyboard ? watchViewport(this.onScrollEvent) : () => {};
    }
    this.input.setSuggestions(this.o.suggestions);
    this.input.setReadOnly(this.o.readOnly);
    if (
      before.tabSize !== this.o.tabSize ||
      before.insertSpaces !== this.o.insertSpaces ||
      before.autoIndent !== this.o.autoIndent ||
      before.autoCloseBrackets !== this.o.autoCloseBrackets
    ) {
      this.core.settings = {
        tabSize: this.o.tabSize,
        insertSpaces: this.o.insertSpaces,
        autoIndent: this.o.autoIndent,
        autoCloseBrackets: this.o.autoCloseBrackets,
      };
    }
    if (looks) this.applyOptions(metrics);
    // Bold or italic tokens change widths and wrapped rows in a font that is not monospace.
    if (!metrics && before.theme !== this.o.theme) this.relayout();
    this.invalidate();
  }

  // Draws plain text until the language and the languages it injects have loaded, then colors.
  setLanguage(id: string): void {
    if (this.destroyed) return;
    if (id === this.language) return;
    this.language = id;
    this.languageReady = false;
    this.missed.clear();
    this.refreshedFor.clear();
    this.core.setLanguage('');
    this.invalidate();
    if (!id) return;
    ensureLanguage(this.m, id).then((ok) => {
      if (this.destroyed || this.language !== id || !ok) return;
      this.languageReady = this.core.setLanguage(id);
      this.urgent = this.languageReady;
      this.invalidate();
    });
  }

  // Runs an edit, then hands its changes and selection to the cache and the listeners.
  apply(edit: () => void): void {
    if (this.destroyed) return;
    const outside = !this.inputting;
    // An edit from outside the keyboard ends a composition first, so it undoes on its own.
    if (outside) this.session.external();
    edit();
    const changes = this.core.takeChanges();
    for (const change of changes) this.changed(change, changes.length);
    const s = this.core.selection;
    const moved = s.anchor !== this.lastSelection.anchor || s.head !== this.lastSelection.head;
    if (moved) this.lastSelection = s;
    if (moved && !this.movingVertically) this.mover.reset();
    if (outside) this.input.write(this.session.sync());
    this.invalidate();
    // Listeners run last, so one that throws leaves the editor and the textarea in step.
    for (const change of changes) this.safely(() => this.o.onChange?.(change));
    if (moved) this.safely(() => this.o.onSelection?.(s.anchor, s.head, this.core.revision));
  }

  focus(): void {
    if (this.destroyed) return;
    this.input.focus();
  }

  blur(): void {
    if (this.destroyed) return;
    this.input.blur();
  }

  get focused(): boolean {
    return !this.destroyed && this.input.focused;
  }

  // The document offset under a page point, or null outside the drawn text.
  offsetAt(clientX: number, clientY: number): number | null {
    if (this.destroyed) return null;
    const d = document as Document & {
      caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?(x: number, y: number): Range | null;
    };
    let node: Node | null = null;
    let offset = 0;
    const position = d.caretPositionFromPoint?.(clientX, clientY);
    if (position) {
      node = position.offsetNode;
      offset = position.offset;
    } else {
      const range = d.caretRangeFromPoint?.(clientX, clientY);
      if (range) {
        node = range.startContainer;
        offset = range.startOffset;
      }
    }
    const el = (node instanceof Element ? node : node?.parentElement)?.closest('[data-line]');
    if (!node || !(el instanceof HTMLElement) || !this.textLayer.contains(el)) {
      return this.offsetBeside(clientX, clientY);
    }
    const line = Number(el.dataset.line);
    const column = columnOf(el, node, offset);
    return this.core.lineStart(line) + Math.min(column, this.core.line(line).length);
  }

  // A point beside the text, past a line's end or in the space below the last line, finds the drawn line by height.
  private offsetBeside(clientX: number, clientY: number): number | null {
    let below = true;
    for (const [line, entry] of this.cache) {
      if (!this.attached.has(line)) continue;
      const r = entry.el.getBoundingClientRect();
      if (clientY >= r.bottom) continue;
      below = false;
      if (clientY < r.top) continue;
      const range = document.createRange();
      const [node, offset] = textPoint(entry.el, entry.text.length);
      range.setStart(node, offset);
      const end = range.getBoundingClientRect().right;
      return this.core.lineStart(line) + (clientX >= end ? entry.text.length : 0);
    }
    return below ? this.core.length : null;
  }

  // A keyboard edit or caret move shows the caret, a selection the page wrote back does not.
  private applyInput(edit: () => void): void {
    const start = probing ? performance.now() : 0;
    const revision = this.core.revision;
    const before = this.core.selection;
    this.inputting = true;
    try {
      this.apply(edit);
    } finally {
      this.inputting = false;
    }
    const after = this.core.selection;
    if (
      this.core.revision === revision &&
      after.anchor === before.anchor &&
      after.head === before.head
    )
      return;
    this.revealing = true;
    if (probing) probeKey(this, performance.now() - start);
  }

  // The selected text for copy or cut. A cut deletes it, except under readOnly.
  private clipboard(cut: boolean): string | null {
    const { anchor, head } = this.core.selection;
    const from = Math.min(anchor, head);
    const to = Math.max(anchor, head);
    if (this.destroyed || from === to) return null;
    const text = this.core.text(from, to);
    if (cut && !this.o.readOnly) this.perform(() => this.core.inputReplace(from, to, ''));
    return text;
  }

  // A hardware key the editor runs itself. True when the browser must not act on it.
  private keyDown(e: KeyboardEvent): boolean {
    if (this.destroyed) return false;
    const command = keyCommand(e, MAC);
    if (!command) return false;
    switch (command.kind) {
      case 'move':
        this.perform(() => this.core.move(command.unit, command.forward, command.extend));
        return true;
      case 'vertical':
        this.vertical(command.by === 'page', command.forward, command.extend);
        return true;
      case 'selectAll':
        this.apply(() => this.core.selectAll());
        return true;
    }
    if (this.o.readOnly) return false;
    const kind = command.kind;
    this.perform(() => {
      if (kind === 'tab') this.core.tab();
      else if (kind === 'shiftTab') this.core.shiftTab();
      else if (kind === 'undo') this.core.undo();
      else this.core.redo();
    });
    return true;
  }

  // Runs an edit or a move from a key or the ref, then shows the caret.
  private perform(edit: () => void): void {
    this.revealing = true;
    this.apply(edit);
  }

  // Moves the caret by rows or by a page of rows, back to the same x after a shorter line.
  private vertical(page: boolean, forward: boolean, extend: boolean): void {
    const pageRows = Math.max(1, Math.floor(this.layout.viewportHeight / this.rowHeight));
    const rows = (page ? pageRows : 1) * (forward ? 1 : -1);
    const { anchor, head } = this.core.selection;
    const target = this.mover.target(this.core, this.geometry, head, rows);
    this.movingVertically = true;
    try {
      this.perform(() => this.core.setSelection(extend ? anchor : target, target));
    } finally {
      this.movingVertically = false;
    }
  }

  // As typed on the keyboard: auto close, indentation on a newline. Nothing under readOnly.
  typeText(text: string): void {
    if (this.destroyed || this.o.readOnly || text === '') return;
    this.perform(() => this.core.typeText(text));
  }

  // Backspace, an empty auto closed pair in one go. Nothing under readOnly.
  deleteBackward(): void {
    if (this.destroyed || this.o.readOnly) return;
    this.perform(() => this.core.backspace());
  }

  deleteForward(): void {
    if (this.destroyed || this.o.readOnly) return;
    this.perform(() => this.core.delete());
  }

  // Moves the caret like the matching key, under readOnly too.
  moveCaret(direction: CaretDirection, extend: boolean): void {
    if (this.destroyed) return;
    const move = MOVES[direction];
    if (move) {
      this.perform(() => this.core.move(move[0], move[1], extend));
      return;
    }
    const page = direction === 'pageUp' || direction === 'pageDown';
    this.vertical(page, direction === 'down' || direction === 'pageDown', extend);
  }

  // The column nearest x (pixels from the line's left) on a row of a line, laid out first when not drawn.
  columnAt(line: number, rowInLine: number, x: number): number {
    if (this.destroyed) return 0;
    const el = this.lineEl(line);
    const text = this.core.line(line);
    const length = text.length;
    const rowOf = (c: number) => this.pointIn(el, c).row;
    const xOf = (c: number) => this.pointIn(el, c).x;
    // Rows only grow along a line, and x along a row.
    const first = firstWhere(0, length + 1, (c) => rowOf(c) >= rowInLine);
    if (first > length) return length;
    const last = firstWhere(first, length + 1, (c) => rowOf(c) > rowInLine) - 1;
    let column = first;
    if (RTL_TEXT.test(text.slice(first, last + 1))) {
      // x does not grow along a row that holds right to left text, so every column is measured.
      for (let c = first + 1; c <= last; c++)
        if (Math.abs(xOf(c) - x) < Math.abs(xOf(column) - x)) column = c;
    } else {
      const at = firstWhere(first, last + 1, (c) => xOf(c) >= x);
      column = at;
      if (at > last) column = last;
      else if (at > first && x - xOf(at - 1) < xOf(at) - x) column = at - 1;
    }
    const unit = text.charCodeAt(column);
    // Never between the two halves of an emoji.
    if (column > 0 && unit >= 0xdc00 && unit <= 0xdfff) column--;
    return column;
  }

  // The element a line is measured in: the drawn one when it holds the current text, else a hidden copy.
  private lineEl(line: number): HTMLDivElement {
    const text = this.core.line(line);
    const entry = this.cache.get(line);
    if (entry && this.attached.has(line) && entry.text === text) return entry.el;
    let copy = this.measuring.get(line);
    if (copy && copy.text !== text) {
      copy.el.remove();
      copy = undefined;
    }
    if (!copy) {
      const el = this.makeLine();
      this.paint(el, text, null);
      el.style.visibility = 'hidden';
      el.style.top = '0px';
      el.style.left = `${this.layout.textAreaLeft + this.layout.textPadding}px`;
      el.style.width = this.o.softWrap ? `${this.layout.wrapWidth}px` : '';
      this.textLayer.append(el);
      copy = { el, text };
      this.measuring.set(line, copy);
    }
    return copy.el;
  }

  // The caret at a column of a line element, in pixels from its left edge and in rows from its top.
  private pointIn(el: HTMLElement, column: number): { x: number; row: number } {
    const box = el.getBoundingClientRect();
    const edge = caretEdge(el, column);
    const middle = edge.top + edge.height / 2 - box.top;
    return { x: edge.x - box.left, row: Math.max(0, Math.floor(middle / this.rowHeight)) };
  }

  private safely(call: () => void): void {
    try {
      call();
    } catch (e) {
      queueMicrotask(() => {
        throw e;
      });
    }
  }

  // A click places the caret and focuses the textarea inside the event, which iOS needs to show its keyboard.
  private click(e: MouseEvent): void {
    if (this.inGap(e.clientY)) return;
    const offset = this.offsetAt(e.clientX, e.clientY);
    if (offset !== null) this.apply(() => this.core.setSelection(offset, offset));
    this.focus();
  }

  // The caret, composing underline and selection, every read before every write so the page lays out once.
  private drawInput(): void {
    const box = this.textLayer.getBoundingClientRect();
    const { anchor, head } = this.core.selection;
    const rootBox = this.root.getBoundingClientRect();
    const caret = this.caretRect(head, rootBox);
    this.drawnCaret = caret;
    const caretLine = this.cache.get(this.core.lineAt(head))?.el;
    // Without soft wrap every line is one row.
    this.drawnCaretRow =
      this.o.softWrap && caret && caretLine
        ? Math.max(
            0,
            Math.round(
              (caret.y + rootBox.top - caretLine.getBoundingClientRect().top) / this.rowHeight,
            ),
          )
        : 0;
    const composing = this.session.composing;
    const bars = composing ? this.rangeRects(composing.start, composing.end) : [];
    const from = Math.min(anchor, head);
    const to = Math.max(anchor, head);
    const selected = from < to ? this.rangeRects(from, to) : [];
    const writeDecorations = this.planDecorations(box);
    if (caret && this.input.focused) {
      put(this.caretEl, 'display', 'block');
      put(this.caretEl, 'left', `${caret.x + rootBox.left - box.left}px`);
      put(this.caretEl, 'top', `${caret.y + rootBox.top - box.top}px`);
      put(this.caretEl, 'height', `${caret.height}px`);
      put(this.caretEl, 'background', this.css.cursor);
      this.input.place(caret.x, caret.y);
    } else {
      put(this.caretEl, 'display', 'none');
    }
    if (bars.length || this.composingLayer.childElementCount) {
      this.composingLayer.replaceChildren(
        ...bars.map((r) => {
          const bar = div(
            `position:absolute;left:${r.left - box.left}px;top:${r.bottom - box.top - 2}px;width:${r.width}px;height:2px;background:${this.css.cursor};`,
          );
          bar.dataset.composing = '';
          return bar;
        }),
      );
    }
    if (selected.length || this.selectionLayer.childElementCount) {
      this.selectionLayer.replaceChildren(
        ...selected.map((r) =>
          div(
            `position:absolute;left:${r.left - box.left}px;top:${r.top - box.top}px;width:${Math.max(r.width, 4)}px;height:${r.height}px;background:${this.css.selection};`,
          ),
        ),
      );
    }
    writeDecorations();
  }

  // The page boxes of the document range on the lines that are drawn.
  private rangeRects(start: number, end: number): DOMRect[] {
    const out: DOMRect[] = [];
    const first = this.core.lineAt(start);
    const last = this.core.lineAt(end);
    for (let line = first; line <= last; line++) {
      const entry = this.cache.get(line);
      if (!entry || !this.attached.has(line)) continue;
      const lineStart = this.core.lineStart(line);
      const a = Math.max(start, lineStart) - lineStart;
      const b = Math.min(end, lineStart + entry.text.length) - lineStart;
      const range = document.createRange();
      const [sn, so] = textPoint(entry.el, a);
      const [en, eo] = textPoint(entry.el, b);
      range.setStart(sn, so);
      range.setEnd(en, eo);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      // An empty part of a line inside the selection still shows a little.
      if (rects.length === 0) rects.push(range.getBoundingClientRect());
      out.push(...rects);
    }
    return out;
  }

  // Scrolls so the line is at the top of the editor, or of the page when the editor does not scroll.
  scrollToLine(line: number): void {
    if (this.destroyed) return;
    const top = this.layout.insetTop + this.layout.rowStart(line) * this.rowHeight;
    if (this.o.scrollEnabled) {
      this.scroller.scrollTop = top - this.layout.insetTop;
    } else {
      window.scrollTo({ top: this.root.getBoundingClientRect().top + window.scrollY + top });
    }
    this.invalidate();
  }

  // Scrolls the least that shows the caret.
  revealSelection(): void {
    if (this.destroyed) return;
    this.revealing = true;
    this.invalidate();
  }

  // Decorations for the text at revision, below zero for the current text. An unknown revision keeps the set.
  setDecorations(items: Decoration[], revision: number): void {
    if (this.destroyed) return;
    this.core.setDecorations(items, revision);
    this.invalidate();
  }

  // The gap under line from the last draw, in the coordinates of caretRect, or null.
  gapRect(line: number): Rect | null {
    return this.drawnGaps.find((g) => g.line === line)?.rect ?? null;
  }

  // Every gap as the full width rows under its line, in the coordinates of caretRect.
  private gapRects(): GapRect[] {
    const layout = this.layout;
    const shift = this.o.scrollEnabled ? 0 : layout.scrollY;
    return layout.gaps().map((g) => ({
      line: g.line,
      rect: { x: 0, y: g.top + shift, width: layout.width, height: g.rows * this.rowHeight },
    }));
  }

  // True when a page y falls in a gap, which belongs to the app's view there.
  private inGap(clientY: number): boolean {
    if (this.drawnGaps.length === 0) return false;
    const y = clientY - this.root.getBoundingClientRect().top;
    return this.drawnGaps.some((g) => y >= g.rect.y && y < g.rect.y + g.rect.height);
  }

  // Reads the decorations' geometry now and returns their writes, so the draw keeps one read phase.
  private planDecorations(box: DOMRect): () => void {
    const items = this.core.decorations();
    const { first, last } = this.drawnWindow;
    const key =
      items.length === 0
        ? ''
        : [
            this.core.decorationsVersion,
            this.core.revision,
            this.appliedRevision,
            first,
            last,
            this.layout.wrapWidth,
            this.rowHeight,
            this.baseline,
          ].join(':');
    if (key === this.decorationsKey) return () => {};
    this.decorationsKey = key;
    const layout = this.layout;
    const backgrounds: Element[] = [];
    const underlines: Element[] = [];
    const windowStart = this.core.lineStart(first);
    const windowEnd = this.core.lineEnd(last);
    for (const d of items) {
      if (d.kind === 'lineBackground') {
        if (d.line < first || d.line > last) continue;
        const el = div(
          `position:absolute;left:${layout.textAreaLeft}px;top:${layout.lineTop(d.line) + layout.scrollY}px;width:${layout.contentWidth + layout.insetRight}px;height:${layout.rows(d.line) * this.rowHeight}px;background:${d.color};`,
        );
        el.dataset.lineBackground = '';
        backgrounds.push(el);
      } else if (d.kind === 'underline') {
        if (d.range.end < windowStart || d.range.start > windowEnd) continue;
        for (const r of this.rowRects(d.range.start, d.range.end)) {
          underlines.push(
            this.underline(d, r.left - box.left, r.right - box.left, r.top - box.top),
          );
        }
      }
    }
    return () => {
      this.lineBackgroundLayer.replaceChildren(...backgrounds);
      this.underlineLayer.replaceChildren(...underlines);
    };
  }

  // The range's page boxes on drawn lines, merged to one per row, with the top of that row.
  private rowRects(start: number, end: number): { left: number; right: number; top: number }[] {
    const out: { left: number; right: number; top: number }[] = [];
    const last = this.core.lineAt(end);
    for (let line = this.core.lineAt(start); line <= last; line++) {
      const entry = this.cache.get(line);
      if (!entry || entry.stale || !this.attached.has(line)) continue;
      const lineStart = this.core.lineStart(line);
      const a = Math.max(start, lineStart) - lineStart;
      const b = Math.min(end, lineStart + entry.text.length) - lineStart;
      if (b <= a) continue;
      const range = document.createRange();
      const [sn, so] = textPoint(entry.el, a);
      const [en, eo] = textPoint(entry.el, b);
      range.setStart(sn, so);
      range.setEnd(en, eo);
      const lineTop = entry.el.getBoundingClientRect().top;
      const rows = new Map<number, { left: number; right: number; top: number }>();
      for (const r of range.getClientRects()) {
        if (r.width <= 0) continue;
        const row = Math.floor((r.top + r.height / 2 - lineTop) / this.rowHeight);
        const seen = rows.get(row);
        if (seen) {
          seen.left = Math.min(seen.left, r.left);
          seen.right = Math.max(seen.right, r.right);
        } else rows.set(row, { left: r.left, right: r.right, top: lineTop + row * this.rowHeight });
      }
      out.push(...rows.values());
    }
    return out;
  }

  // One underline piece on a row, solid as a bar or wavy as a clipped path, as DecorationPainter.kt draws them.
  private underline(
    d: Extract<Decoration, { kind: 'underline' }>,
    left: number,
    right: number,
    rowTop: number,
  ): Element {
    const thickness = d.thickness ?? 1;
    const offset = d.offset ?? 2;
    if (d.style !== 'wavy') {
      const bar = div(
        `position:absolute;left:${left}px;top:${solidTop(rowTop, this.baseline, offset)}px;width:${right - left}px;height:${Math.max(1, Math.round(thickness))}px;background:${d.color};`,
      );
      bar.dataset.underline = '';
      return bar;
    }
    // The wave's centre sits a thickness below a solid line's top, and the box clips it like native.
    const pad = waveAmplitude(thickness) + thickness;
    const centre = rowTop + this.baseline + offset + thickness;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width', String(right - left));
    svg.setAttribute('height', String(2 * pad));
    svg.style.cssText = `position:absolute;left:${left}px;top:${centre - pad}px;overflow:hidden;`;
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', wavePath(0, right - left, pad, thickness));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', d.color);
    path.setAttribute('stroke-width', String(thickness));
    svg.append(path);
    svg.dataset.underline = '';
    return svg;
  }

  // Scrolls the least that shows the caret, by its line's row while the line is not drawn. True when it scrolled.
  private revealCaret(): boolean {
    const caret = this.drawnCaret;
    const line = this.core.lineAt(this.core.selection.head);
    let row = this.layout.rowStart(line);
    if (caret) {
      // The caret's row inside a wrapped line, from where the browser drew it.
      row += this.drawnCaretRow;
    }
    const top = row * this.rowHeight;
    const x = caret ? caret.x - this.layout.textLeft : 0;
    return this.layout.reveal(x, top, x + 1, top + this.rowHeight);
  }

  // The caret at offset in view coordinates, or null when its line is not drawn.
  caretRect(offset: number, rootBox?: DOMRect): Rect | null {
    if (this.destroyed) return null;
    const line = this.core.lineAt(offset);
    const entry = this.cache.get(line);
    if (!entry || entry.stale || !this.attached.has(line)) return null;
    const box = rootBox ?? this.root.getBoundingClientRect();
    const edge = caretEdge(entry.el, offset - this.core.lineStart(line));
    return { x: edge.x - box.left, y: edge.top - box.top, width: 1, height: this.rowHeight };
  }

  visibleLines(): { first: number; last: number } {
    if (this.destroyed) return { first: 0, last: 0 };
    return { first: this.layout.firstVisibleLine(), last: this.layout.lastVisibleLine() };
  }

  // One page frame: drawn only when something changed since the last one.
  draw(): void {
    if (this.destroyed) return;
    if (this.core.snapshotCount !== this.seenSnapshots) {
      this.seenSnapshots = this.core.snapshotCount;
      this.dirty = true;
      this.loadMissed();
    }
    if (!this.dirty) return;
    this.dirty = false;
    for (const copy of this.measuring.values()) copy.el.remove();
    this.measuring.clear();
    this.configure();
    this.restaleRefreshed();
    let moved = this.frame();
    // A caret moved off screen scrolls into view before the paint: by row while its line is not drawn, then by x.
    for (let pass = 0; this.revealing && pass < 2; pass++) {
      if (this.drawnCaret) this.revealing = false;
      const [beforeX, beforeY] = [this.layout.scrollX, this.layout.scrollY];
      if (!this.revealCaret()) break;
      this.syncScroll();
      const caret = this.drawnCaret;
      if (caret && this.layout.scrollY === beforeY) {
        // Lines and the caret scroll with the content: only the textarea, placed in view coordinates, follows.
        const x = caret.x - (this.layout.scrollX - beforeX);
        this.drawnCaret = { ...caret, x };
        if (this.input.focused) this.input.place(x, caret.y);
        break;
      }
      moved = this.frame();
    }
    this.revealing = false;
    if (moved) {
      this.syncScroll();
      this.dirty = true;
    }
    this.report();
    if (this.dirty) requestPump();
  }

  // Lays out and places the visible lines at the current scroll. True when measuring moved the layout's scroll.
  private frame(): boolean {
    const [sx, sy] = this.scrollPosition();
    this.layout.beginDraw(sx, sy);
    try {
      const frame = this.readFrame();
      const moved = this.prepare(frame);
      this.place(frame);
      this.drawnGaps = this.gapRects();
      this.drawInput();
      return moved;
    } finally {
      this.layout.endDraw();
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unregister();
    this.offRegistered();
    this.input.destroy();
    this.scroller.removeEventListener('click', this.onClickEvent);
    this.scroller.removeEventListener('mousedown', this.onMouseDownEvent);
    this.listenToPage(false);
    this.offViewport();
    this.resize?.disconnect();
    document.fonts?.removeEventListener?.('loadingdone', this.remeasureEvent);
    this.scroller.removeEventListener('scroll', this.onScrollEvent);
    this.root.remove();
    if (this.frameInts) this.m._free(this.frameInts);
    if (this.frameText) this.m._free(this.frameText);
    this.core.close();
    // The engine finishes closing in the pump, which may have no other editor to run for.
    requestPump();
  }

  // True when the next frame has something to draw: a change, or a snapshot not drawn yet.
  pending(): boolean {
    return !this.destroyed && (this.dirty || this.core.snapshotCount !== this.seenSnapshots);
  }

  private invalidate(): void {
    if (this.destroyed) return;
    this.dirty = true;
    requestPump();
  }

  // A new snapshot at the drawn revision is a refresh, so every cached line is queried again.
  private restaleRefreshed(): void {
    const snapshot = this.languageReady ? this.core.snapshot : 0;
    if (snapshot === this.drawnSnapshot) return;
    this.drawnSnapshot = snapshot;
    if (snapshot === 0 || this.snapshotInfo(snapshot).revision !== this.appliedRevision) return;
    for (const entry of this.cache.values()) entry.revision = -1;
  }

  // Loads languages the engine could not find, like a fence's, and refreshes once per language that registered.
  private loadMissed(): void {
    for (const name of this.core.takeMissedLanguages()) this.missed.add(name);
    if (!this.missed.size) return;
    const language = this.language;
    ensureInjected(this.m, [...this.missed]).then((ids) => {
      if (this.destroyed || this.language !== language) return;
      const fresh = ids.filter((id) => !this.refreshedFor.has(id));
      if (!fresh.length) return;
      for (const id of fresh) this.refreshedFor.add(id);
      this.missed.clear();
      this.core.refreshInjections();
      this.invalidate();
    });
  }

  private readonly remeasureEvent = () => this.remeasure();

  // A web font finished loading: every line is measured again.
  private remeasure(): void {
    if (this.destroyed) return;
    this.applyOptions(true);
    this.invalidate();
  }

  private listening = false;

  private listenToPage(on: boolean): void {
    if (on === this.listening) return;
    this.listening = on;
    const method = on ? 'addEventListener' : 'removeEventListener';
    window[method]('scroll', this.onScrollEvent, {
      capture: true,
      passive: true,
    } as AddEventListenerOptions);
    window[method]('resize', this.onScrollEvent);
  }

  private applyOptions(metrics: boolean): void {
    const o = this.o;
    this.css = cssTheme(o.theme);
    const font = o.fontFamily ? `"${o.fontFamily}", ${MONOSPACE}` : MONOSPACE;
    this.rowHeight = Math.max(1, Math.round(o.fontSize * o.lineHeight));
    Object.assign(this.root.style, {
      background: this.css.background,
      color: this.css.foreground,
      fontFamily: font,
      fontSize: `${o.fontSize}px`,
      lineHeight: `${this.rowHeight}px`,
      tabSize: String(o.tabSize),
      height: o.scrollEnabled ? '100%' : this.root.style.height,
    });
    this.scroller.style.overflowY = o.scrollEnabled ? 'auto' : 'hidden';
    this.scroller.style.overflowX = o.softWrap ? 'hidden' : 'auto';
    Object.assign(this.gutter.style, {
      background: this.css.gutterBackground,
      color: this.css.gutterForeground,
      display: o.lineNumbers ? 'block' : 'none',
    });
    this.activeLine.style.background = this.css.activeLine;
    this.placeholderEl.style.color = this.css.gutterForeground;
    if (metrics) {
      this.charWidth = measureChar(this.root);
      this.baseline = measureBaseline(this.root);
      this.layout.rowHeight = this.rowHeight;
      this.layout.wrap = o.softWrap;
      this.relayout();
    }
  }

  // Every line is laid out again on the next draw.
  private relayout(): void {
    for (const entry of this.cache.values()) entry.el.remove();
    this.cache.clear();
    this.attached.clear();
    this.layout.resetRows();
  }

  private configure(): void {
    const o = this.o;
    const insets = o.contentInsets;
    const width = Math.round(this.scroller.clientWidth);
    const height = o.scrollEnabled ? Math.round(this.scroller.clientHeight) : window.innerHeight;
    const digits = Math.max(2, String(this.core.lineCount).length);
    const gutter = o.lineNumbers ? Math.ceil(this.charWidth * (digits + 2)) : 0;
    const before = this.layout.textAreaWidth;
    if (this.layout.gutterWidth !== gutter) this.layout.gutterWidth = gutter;
    if (this.layout.textPadding !== o.textPadding) this.layout.textPadding = o.textPadding;
    this.layout.resize(width, height);
    // An editor that sizes to its text leaves the keyboard to the page.
    const keyboard = o.avoidKeyboard && o.scrollEnabled ? overlapOf(this.root) : 0;
    if (keyboard > this.keyboard && this.input.focused) this.revealing = true;
    this.keyboard = keyboard;
    const bottom = (insets.bottom ?? 0) + keyboard;
    this.layout.setInsets(insets.top ?? 0, bottom, insets.left ?? 0, insets.right ?? 0);
    if (o.softWrap && this.layout.textAreaWidth !== before) this.relayout();
  }

  // The scroll the core draws at: the editor's own, or with scrolling off where the page shows the editor.
  private scrollPosition(): [number, number] {
    if (this.o.scrollEnabled) return [this.scroller.scrollLeft, this.scroller.scrollTop];
    const top = this.root.getBoundingClientRect().top;
    return [this.scroller.scrollLeft, Math.max(0, Math.round(-top))];
  }

  private syncScroll(): void {
    if (this.o.scrollEnabled) this.scroller.scrollTop = this.layout.scrollY;
    this.scroller.scrollLeft = this.layout.scrollX;
  }

  private snapshotInfo(snapshot: number): { revision: number; basedOn: number } {
    const out = this.m._malloc(SNAPSHOT_INFO_INTS * 4);
    this.m._cp_snapshot_info_get(snapshot, out);
    const revision = this.m.HEAP32[out >> 2] as number;
    const basedOn = this.m.HEAP32[(out >> 2) + 1] as number;
    this.m._free(out);
    return { revision, basedOn };
  }

  // The draw's one frame call: the layout picks the lines, the frame says which need a layout and brings them.
  private readFrame(): DecodedFrame {
    const m = this.m;
    const snapshot = this.languageReady ? this.core.snapshot : 0;
    const info = snapshot ? this.snapshotInfo(snapshot) : null;
    const incremental = info !== null && info.basedOn >= 0 && info.basedOn === this.appliedRevision;
    const pairs: number[] = [];
    for (const [line, entry] of this.cache) if (!entry.stale) pairs.push(line, entry.revision);
    const entries = m._malloc(Math.max(1, pairs.length) * 4);
    m.HEAP32.set(pairs, entries >> 2);
    const lenPtr = m._malloc(4);
    try {
      for (;;) {
        if (!this.frameInts) this.growFrame(4096, 16384);
        const needed =
          m._cp_editor_frame(
            this.core.handle,
            this.layout.handle,
            snapshot,
            this.appliedRevision,
            incremental ? 1 : 0,
            entries,
            pairs.length / 2,
            this.frameInts,
            this.frameIntsCap,
            this.frameText,
            this.frameTextCap,
            lenPtr,
          ) >>> 0;
        const textLength = (m.HEAP32[lenPtr >> 2] as number) >>> 0;
        if (needed <= this.frameIntsCap && textLength <= this.frameTextCap) {
          const ints = m.HEAP32.subarray(this.frameInts >> 2, (this.frameInts >> 2) + needed);
          const text = m.HEAPU16.subarray(this.frameText >> 1, (this.frameText >> 1) + textLength);
          return decodeFrame(ints, text);
        }
        this.growFrame(
          Math.max(needed, this.frameIntsCap),
          Math.max(textLength, this.frameTextCap),
        );
      }
    } finally {
      m._free(entries);
      m._free(lenPtr);
    }
  }

  private growFrame(ints: number, units: number): void {
    const m = this.m;
    if (ints > this.frameIntsCap) {
      if (this.frameInts) m._free(this.frameInts);
      this.frameIntsCap = ints;
      this.frameInts = m._malloc(ints * 4);
    }
    if (units > this.frameTextCap) {
      if (this.frameText) m._free(this.frameText);
      this.frameTextCap = units;
      this.frameText = m._malloc(Math.max(2, units * 2));
    }
  }

  // Builds the lines the frame marks dirty and ends with the draw's measure call. True when it moved the scroll.
  private prepare(frame: DecodedFrame): boolean {
    const snapshot = this.languageReady ? this.core.snapshot : 0;
    const consistent = snapshot !== 0 && this.snapshotInfo(snapshot).revision === frame.revision;
    const revision = consistent ? frame.revision : -1;
    const pairs: number[] = [];
    const fresh: [number, Entry][] = [];
    for (const run of frame.runs) {
      for (let line = run.lo; line <= run.hi; line++) {
        const data = run.lines[line - run.lo];
        if (!data) continue;
        const entry = this.cache.get(line);
        let spans: Int32Array | null = null;
        if (consistent) {
          spans = data.spans.length > 0 ? data.spans : null;
          if (entry && entry.text === data.text && sameSpans(entry.spans, spans)) {
            entry.revision = revision;
            continue;
          }
        } else {
          spans = this.keptSpans(line, frame.revision);
        }
        const el = entry?.el ?? this.makeLine();
        el.dataset.line = String(line);
        this.paint(el, data.text, spans);
        // The width it wraps at, before prepare reads its height.
        el.style.width = this.o.softWrap ? `${this.layout.wrapWidth}px` : '';
        const next = { el, revision, spans, text: data.text };
        this.cache.delete(line);
        this.cache.set(line, next);
        if (!el.isConnected) this.textLayer.append(el);
        fresh.push([line, next]);
      }
    }
    for (let line = frame.first; line <= frame.last; line++) {
      const entry = this.cache.get(line);
      if (entry && revision >= 0 && entry.revision !== revision && !inRuns(frame, line))
        entry.revision = revision;
    }
    if (revision >= 0) {
      this.appliedRevision = revision;
      this.urgent = false;
      this.kept = null;
    }
    let widest = -1;
    for (const [line, entry] of fresh) {
      const rows = this.o.softWrap
        ? Math.max(1, Math.round(entry.el.offsetHeight / this.rowHeight))
        : 1;
      pairs.push(line, rows);
      if (!this.o.softWrap) widest = Math.max(widest, Math.ceil(entry.el.offsetWidth));
    }
    return this.layout.measure(pairs, widest, frame.first, frame.last);
  }

  // Places the window's lines, numbers and active line, and takes every other line out of the page.
  private place(frame: DecodedFrame): void {
    const layout = this.layout;
    this.drawnWindow = { first: frame.first, last: frame.last };
    const scrollY = layout.scrollY;
    const left = layout.textAreaLeft + layout.textPadding;
    const width = layout.textAreaLeft + layout.contentWidth + layout.insetRight;
    const height = layout.insetTop + layout.contentHeight + layout.insetBottom;
    put(this.content, 'width', `${width}px`);
    put(this.content, 'height', `${height}px`);
    put(this.gutter, 'width', `${layout.insetLeft + layout.gutterWidth}px`);
    put(this.gutter, 'height', `${height}px`);
    if (!this.o.scrollEnabled) this.root.style.height = `${height}px`;
    const visible = new Set<number>();
    for (let line = frame.first; line <= frame.last; line++) {
      const entry = this.cache.get(line);
      if (!entry) continue;
      visible.add(line);
      const top = layout.lineTop(line) + scrollY;
      put(entry.el, 'top', `${top}px`);
      put(entry.el, 'left', `${left}px`);
      put(entry.el, 'width', this.o.softWrap ? `${layout.wrapWidth}px` : '');
      if (!entry.el.isConnected) this.textLayer.append(entry.el);
      this.attached.add(line);
      this.number(line, top, frame.caretLine === line);
    }
    for (const line of this.attached) {
      if (visible.has(line)) continue;
      this.cache.get(line)?.el.remove();
      this.attached.delete(line);
    }
    for (const [line, el] of this.gutterLines) {
      if (visible.has(line)) continue;
      el.remove();
      this.gutterLines.delete(line);
    }
    this.evict(visible);
    const collapsed = frame.anchor === frame.head;
    const showActive = this.o.highlightActiveLine && collapsed && visible.has(frame.caretLine);
    put(this.activeLine, 'display', showActive ? 'block' : 'none');
    if (showActive) {
      put(this.activeLine, 'top', `${layout.lineTop(frame.caretLine) + scrollY}px`);
      put(this.activeLine, 'height', `${layout.rows(frame.caretLine) * this.rowHeight}px`);
      put(this.activeLine, 'width', `${width}px`);
    }
    const empty = frame.length === 0 && this.o.placeholder !== '';
    put(this.placeholderEl, 'display', empty ? 'block' : 'none');
    if (empty) {
      this.placeholderEl.textContent = this.o.placeholder;
      this.placeholderEl.style.top = `${layout.insetTop}px`;
      this.placeholderEl.style.left = `${left}px`;
    }
  }

  private number(line: number, top: number, active: boolean): void {
    if (!this.o.lineNumbers) return;
    let el = this.gutterLines.get(line);
    if (!el) {
      el = div('position:absolute;left:0;text-align:right;');
      this.gutter.append(el);
      this.gutterLines.set(line, el);
    }
    put(el, 'text', String(line + 1));
    put(el, 'top', `${top}px`);
    put(el, 'width', `${this.layout.insetLeft + this.layout.gutterWidth - this.charWidth}px`);
    put(el, 'color', active ? this.css.gutterActiveForeground : '');
  }

  // Keeps about three screens of laid out lines.
  private evict(visible: Set<number>): void {
    const cap = Math.max(64, 3 * (visible.size + 1));
    for (const line of this.cache.keys()) {
      if (this.cache.size <= cap) break;
      if (!visible.has(line)) this.cache.delete(line);
    }
  }

  // Fires the events of this draw: content size, the first draw, then scroll.
  private report(): void {
    const layout = this.layout;
    const width = layout.textAreaLeft + layout.contentWidth + layout.insetRight;
    // The keyboard's inset is not the content's size.
    const height = layout.insetTop + layout.contentHeight + layout.insetBottom - this.keyboard;
    if (width !== this.lastContent.width || height !== this.lastContent.height) {
      this.lastContent = { width, height };
      this.o.onContentSize?.(width, height);
    }
    const gaps = JSON.stringify(this.drawnGaps);
    if (gaps !== this.reportedGaps) {
      this.reportedGaps = gaps;
      this.o.onGapLayout?.(this.drawnGaps);
    }
    if (!this.drawn) {
      this.drawn = true;
      this.o.onFirstDraw?.();
      if (this.o.autoFocus) this.focus();
    }
    const x = layout.scrollX;
    const y = this.o.scrollEnabled ? layout.scrollY : 0;
    if (x !== this.lastScroll.x || y !== this.lastScroll.y) {
      this.lastScroll = { x, y };
      this.o.onScroll?.(x, y, layout.contentWidth, layout.contentHeight);
    }
  }

  private makeLine(): HTMLDivElement {
    return div('position:absolute;direction:ltr;');
  }

  // Fills a line element with its text, one span per styled run.
  private paint(el: HTMLDivElement, text: string, spans: Int32Array | null): void {
    el.style.whiteSpace = this.o.softWrap ? 'pre-wrap' : 'pre';
    el.style.overflowWrap = this.o.softWrap ? 'anywhere' : 'normal';
    el.replaceChildren();
    let at = 0;
    if (spans) {
      for (let i = 0; i + 2 < spans.length; i += 3) {
        const start = Math.max(at, spans[i] as number);
        const end = Math.min(text.length, spans[i + 1] as number);
        if (end <= start) continue;
        if (start > at) el.append(text.slice(at, start));
        const style = this.css.token(styleName(this.m, spans[i + 2] as number));
        const span = document.createElement('span');
        span.textContent = text.slice(start, end);
        if (style) {
          span.style.color = style.color;
          if (style.bold) span.style.fontWeight = 'bold';
          if (style.italic) span.style.fontStyle = 'italic';
        }
        el.append(span);
        at = end;
      }
    }
    if (at < text.length) el.append(text.slice(at));
  }

  // Moves the cache along an edit and keeps the edited line's spans shifted until the parse catches up.
  private changed(change: WebChange, count: number): void {
    if (count > 1) {
      this.urgent = this.languageReady;
      this.kept = null;
      this.relayout();
      return;
    }
    const first = this.core.lineAt(change.start);
    const oldCount = lineSpan(change.removed);
    const newCount = lineSpan(change.inserted);
    // Colors the edited lines show, from the cache or from an earlier edit since the last frame.
    const inside = (line: number) => line >= first && line < first + oldCount;
    const kept = this.kept;
    let colored =
      kept !== null &&
      ((inside(kept.line) && kept.spans !== null) || (inside(kept.line + 1) && kept.tail !== null));
    for (const [line, entry] of this.cache) {
      if (colored) break;
      colored = inside(line) && entry.spans !== null;
    }
    this.keepSpans(first, oldCount, newCount, change);
    if (colored && this.kept === null) this.urgent = true;
    const delta = newCount - oldCount;
    // An edit inside one line moves no other line.
    if (oldCount === 1 && newCount === 1) {
      const entry = this.cache.get(first);
      if (entry) entry.stale = true;
      return;
    }
    const moved: [number, Entry][] = [];
    for (const [line, entry] of this.cache) {
      if (line < first) moved.push([line, entry]);
      else if (line >= first + oldCount) moved.push([line + delta, entry]);
      else if (oldCount === 1 && newCount === 1) {
        entry.stale = true;
        moved.push([line, entry]);
      } else entry.el.remove();
    }
    this.cache.clear();
    this.attached.clear();
    for (const [line, entry] of moved) {
      entry.el.dataset.line = String(line);
      this.cache.set(line, entry);
      if (entry.el.isConnected) this.attached.add(line);
    }
  }

  // The spans a line shows now: its cache entry, else what an edit since the last frame kept for it.
  private shownSpans(line: number): Int32Array | null {
    const entry = this.cache.get(line);
    if (entry && !entry.stale) return entry.spans;
    const kept = this.kept;
    if (!kept) return null;
    if (line === kept.line) return kept.spans;
    return line === kept.line + 1 ? kept.tail : null;
  }

  private keepSpans(first: number, oldCount: number, newCount: number, change: WebChange): void {
    const spans = this.shownSpans(first);
    this.kept = null;
    if (oldCount !== 1 || !spans) return;
    const column = change.start - this.core.lineStart(first);
    const revision = this.core.revision;
    if (newCount === 1) {
      const kept = shiftSpans(this.m, spans, column, change.removedLength, change.insertedLength);
      this.kept = { line: first, revision, spans: kept, tail: null };
    } else if (newCount === 2 && change.removedLength === 0 && change.inserted.startsWith('\n')) {
      const added = change.insertedLength - 1;
      const tail = shiftSpans(this.m, spans, 0, column, added);
      const lineLength = this.core.lineEnd(first + 1) - this.core.lineStart(first + 1);
      const head = shiftSpans(this.m, spans, column, lineLength - added, 0);
      this.kept = { line: first, revision, spans: head, tail };
    }
  }

  private keptSpans(line: number, revision: number): Int32Array | null {
    const kept = this.kept;
    if (!kept || kept.revision !== revision) return null;
    if (line === kept.line) return kept.spans;
    if (line === kept.line + 1) return kept.tail;
    return null;
  }
}

// The text node and offset at a column of a line element.
function textPoint(el: HTMLElement, column: number): [Node, number] {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let at = 0;
  let last: Text | null = null;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (column <= at + node.data.length) return [node, column - at];
    at += node.data.length;
    last = node;
  }
  return last ? [last, last.data.length] : [el, 0];
}

// The column of a DOM point inside a line element.
function columnOf(el: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let at = 0;
  for (let text = walker.nextNode() as Text | null; text; text = walker.nextNode() as Text | null) {
    if (text === node) return at + offset;
    if (node !== el && node.contains(text)) return at;
    if (node === el && el.childNodes[offset]?.contains(text)) return at;
    at += text.data.length;
  }
  return at;
}

// The caret's blink, added to the page once.
function blinkStyle(): void {
  if (document.getElementById('codepad-blink')) return;
  const style = document.createElement('style');
  style.id = 'codepad-blink';
  style.textContent = '@keyframes codepad-blink { 50% { opacity: 0; } }';
  document.head.append(style);
}

function div(css: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = css;
  return el;
}

function measureChar(root: HTMLElement): number {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';
  probe.textContent = '0000000000';
  root.append(probe);
  const width = probe.getBoundingClientRect().width / 10;
  probe.remove();
  return width || 8;
}

function lineSpan(text: string): number {
  let n = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function inRuns(frame: DecodedFrame, line: number): boolean {
  return frame.runs.some((r) => line >= r.lo && line <= r.hi);
}

function sameSpans(a: Int32Array | null, b: Int32Array | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const RTL = /^[֐-ࣿיִ-﷿ﹰ-﻿]/;

// The caret at a column in page coordinates: the leading edge of the next character unless it reads right to left.
function caretEdge(el: HTMLElement, column: number): { x: number; top: number; height: number } {
  const next = charRect(el, column, true);
  const prev = charRect(el, column, false);
  const at = (x: number, r: DOMRect) => ({ x, top: r.top, height: r.height });
  if (next && !next.rtl) return at(next.rect.left, next.rect);
  if (prev && !prev.rtl) return at(prev.rect.right, prev.rect);
  if (next) return at(next.rect.right, next.rect);
  if (prev) return at(prev.rect.left, prev.rect);
  const box = el.getBoundingClientRect();
  return { x: box.left, top: box.top, height: 0 };
}

const written = new WeakMap<HTMLElement, Record<string, string>>();

// Writes a style, or the text under key text, only when it changed, so an unchanged draw keeps the layout valid.
function put(el: HTMLElement, key: string, value: string): void {
  let last = written.get(el);
  if (!last) {
    last = {};
    written.set(el, last);
  }
  if (last[key] === value) return;
  last[key] = value;
  if (key === 'text') el.textContent = value;
  else el.style.setProperty(key, value);
}

// The first integer in [lo, hi) where test holds, or hi, for a test that stays true once it holds.
function firstWhere(lo: number, hi: number, test: (n: number) => boolean): number {
  let a = lo;
  let b = hi;
  while (a < b) {
    const mid = (a + b) >>> 1;
    if (test(mid)) b = mid;
    else a = mid + 1;
  }
  return a;
}

// The box of the character after column (forward) or before it, and whether it reads right to left.
function charRect(
  el: HTMLElement,
  column: number,
  forward: boolean,
): { rect: DOMRect; rtl: boolean } | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let at = 0;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const length = node.data.length;
    const inside = forward
      ? column >= at && column < at + length
      : column > at && column <= at + length;
    if (inside) {
      const i = column - at;
      const low = (c: number) => c >= 0xdc00 && c <= 0xdfff;
      const start = forward ? i : low(node.data.charCodeAt(i - 1)) && i > 1 ? i - 2 : i - 1;
      const end = forward ? (low(node.data.charCodeAt(i + 1)) ? i + 2 : i + 1) : i;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
      return { rect, rtl: RTL.test(node.data.slice(start, end)) };
    }
    at += length;
  }
  return null;
}

const styleNames = new WeakMap<CoreModule, Map<number, string>>();

function styleName(m: CoreModule, id: number): string {
  let names = styleNames.get(m);
  if (!names) {
    names = new Map();
    styleNames.set(m, names);
  }
  const cached = names.get(id);
  if (cached !== undefined) return cached;
  const out = m._malloc(256);
  const length = m._cp_style_name(id, out, 256);
  const name = m.UTF8ToString(out, Math.min(length, 255));
  m._free(out);
  names.set(id, name);
  return name;
}

function shiftSpans(
  m: CoreModule,
  spans: Int32Array,
  start: number,
  removed: number,
  inserted: number,
): Int32Array | null {
  const cap = spans.length + 6;
  const input = m._malloc(Math.max(1, spans.length) * 4);
  const out = m._malloc(cap * 4);
  try {
    m.HEAP32.set(spans, input >> 2);
    const n = m._cp_shift_spans(input, spans.length, start, removed, inserted, out, cap) >>> 0;
    if (n > cap) return null;
    return m.HEAP32.slice(out >> 2, (out >> 2) + n);
  } finally {
    m._free(input);
    m._free(out);
  }
}
