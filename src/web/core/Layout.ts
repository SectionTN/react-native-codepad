import type { EditorCore } from './EditorCore';
import type { CoreModule, Heap } from './module';
import { heapOf } from './module';

export type Anchor = { line: number; offset: number };
// A gap under a line: the view y where it starts and its height in rows.
export type Gap = { line: number; top: number; rows: number };

// cp_geometry, in the order of its fields.
const G = {
  scrollX: 0,
  scrollY: 1,
  maxScrollX: 2,
  maxScrollY: 3,
  contentWidth: 4,
  contentHeight: 5,
  firstLine: 6,
  lastLine: 7,
  textAreaLeft: 8,
  textAreaWidth: 9,
  viewportHeight: 10,
  wrapWidth: 11,
  textLeft: 12,
  totalRows: 13,
  lineCount: 14,
  rowHeight: 15,
  widestLine: 16,
} as const;
const GEOMETRY_INTS = 17;
const CONFIG_INTS = 10;

// Scroll position, rows per line and the mapping between rows and view pixels, held by the core's layout of one
// editor. Outside a draw each member is one core call. Inside one, the members read the copy the draw's scroll and
// measure calls returned. The web twin of ios/Codepad/layout/Viewport.swift.
export class Layout {
  readonly handle: number;
  private readonly m: CoreModule;
  private readonly heap: Heap;
  // row_height, width, height, inset_top, inset_bottom, inset_left, inset_right, gutter_width, text_padding, wrap
  private readonly config = new Int32Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  private drawing = false;
  private cached = false;
  private known = new Int32Array(GEOMETRY_INTS);
  private first = 0;
  private last = -1;
  private buffer = new Int32Array(0);
  private needed = 0;

  constructor(private readonly core: EditorCore) {
    this.m = core.m;
    this.heap = heapOf(core.m);
    this.handle = this.m._cpw_layout(core.index);
  }

  // Takes the editor's lines, one row each, and its gaps. The size, insets and metrics stay.
  attach(): void {
    this.changing();
    this.m._cp_editor_attach_layout(this.core.handle, this.handle);
  }

  get rowHeight(): number {
    return this.config[0] as number;
  }
  set rowHeight(v: number) {
    this.config[0] = v;
    this.configure();
  }
  get width(): number {
    return this.config[1] as number;
  }
  get height(): number {
    return this.config[2] as number;
  }
  get insetTop(): number {
    return this.config[3] as number;
  }
  get insetBottom(): number {
    return this.config[4] as number;
  }
  get insetLeft(): number {
    return this.config[5] as number;
  }
  get insetRight(): number {
    return this.config[6] as number;
  }
  get gutterWidth(): number {
    return this.config[7] as number;
  }
  set gutterWidth(v: number) {
    this.config[7] = v;
    this.configure();
  }
  get textPadding(): number {
    return this.config[8] as number;
  }
  set textPadding(v: number) {
    this.config[8] = v;
    this.configure();
  }
  get wrap(): boolean {
    return this.config[9] !== 0;
  }
  set wrap(v: boolean) {
    this.config[9] = v ? 1 : 0;
    this.configure();
  }
  get widestLine(): number {
    return this.g(G.widestLine);
  }
  set widestLine(v: number) {
    this.changing();
    this.m._cp_layout_set_widest(this.handle, v);
  }

  get scrollX(): number {
    return this.g(G.scrollX);
  }
  get scrollY(): number {
    return this.g(G.scrollY);
  }
  get textAreaLeft(): number {
    return this.g(G.textAreaLeft);
  }
  get textAreaWidth(): number {
    return this.g(G.textAreaWidth);
  }
  get viewportHeight(): number {
    return this.g(G.viewportHeight);
  }
  // Width a line wraps at. Zero means no wrapping.
  get wrapWidth(): number {
    return this.g(G.wrapWidth);
  }
  get textLeft(): number {
    return this.g(G.textLeft);
  }
  get contentWidth(): number {
    return this.g(G.contentWidth);
  }
  get contentHeight(): number {
    return this.g(G.contentHeight);
  }
  get maxScrollX(): number {
    return this.g(G.maxScrollX);
  }
  get maxScrollY(): number {
    return this.g(G.maxScrollY);
  }
  get totalRows(): number {
    return this.g(G.totalRows);
  }
  get lineCount(): number {
    return this.g(G.lineCount);
  }

  // Starts a draw at the scroll position, clamped. True when the position moved.
  beginDraw(scrollX: number, scrollY: number): boolean {
    this.drawing = true;
    this.last = this.first - 1;
    const out = this.heap.output(GEOMETRY_INTS * 4);
    const moved = this.m._cp_layout_scroll_to(this.handle, scrollX, scrollY, out) !== 0;
    this.known = this.heap.readInts(out, GEOMETRY_INTS);
    this.cached = true;
    return moved;
  }

  // The draw's measure call: the rows laid out in this draw and the widest line, then the tops and rows of
  // first..last and every gap. True when a measured line above the view moved the scroll.
  measure(pairs: number[], widest: number, first: number, last: number): boolean {
    const before = this.scrollY;
    this.first = first;
    this.last = last;
    this.fill(pairs, widest);
    return this.known[G.scrollY] !== before;
  }

  endDraw(): void {
    this.drawing = false;
    this.cached = false;
    this.last = this.first - 1;
  }

  // Clamps and applies. Returns true when the position moved.
  scrollTo(x: number, y: number): boolean {
    const out = this.heap.output(GEOMETRY_INTS * 4);
    const moved = this.m._cp_layout_scroll_to(this.handle, x, y, out) !== 0;
    this.moving(out, moved);
    return moved;
  }

  clamp(): boolean {
    return this.scrollTo(this.scrollX, this.scrollY);
  }

  // Stores a view size. True when the text area width changed, which is when layouts must be rebuilt.
  resize(width: number, height: number): boolean {
    this.config[1] = width;
    this.config[2] = height;
    return this.configure();
  }

  // Stores the insets. True when the text area width changed.
  setInsets(top: number, bottom: number, left: number, right: number): boolean {
    this.config.set([top, bottom, left, right], 3);
    return this.configure();
  }

  rowStart(line: number): number {
    const top = this.drawnTop(line);
    if (top !== null) {
      return Math.trunc((top - this.insetTop + (this.known[G.scrollY] as number)) / this.rowHeight);
    }
    return this.m._cp_layout_row_start(this.handle, line);
  }

  rows(line: number): number {
    if (this.cached && line >= this.first && line <= this.last) {
      return this.buffer[this.last - this.first + 2 + line - this.first] as number;
    }
    return this.m._cp_layout_rows(this.handle, line);
  }

  gapRows(line: number): number {
    return this.m._cp_layout_gap_rows(this.handle, line);
  }

  lineAtRow(row: number): number {
    return this.m._cp_layout_line_at_row(this.handle, row);
  }

  // True when row is empty space under a line rather than one of its text rows.
  isGapRow(row: number): boolean {
    return this.m._cp_layout_is_gap_row(this.handle, row) !== 0;
  }

  rowTop(row: number): number {
    if (this.cached)
      return this.insetTop + row * this.rowHeight - (this.known[G.scrollY] as number);
    return this.m._cp_layout_row_top(this.handle, row);
  }

  lineTop(line: number): number {
    return this.drawnTop(line) ?? this.m._cp_layout_line_top(this.handle, line);
  }

  // Content row under view y, possibly outside [0, totalRows).
  rowAt(y: number): number {
    return this.m._cp_layout_row_at(this.handle, y);
  }

  // Every gap in line order.
  gaps(): Gap[] {
    if (!this.cached || this.last < this.first) {
      const count = this.m._cp_layout_measure(this.handle, 0, 0, -1, 0, 0, 0, 0, 0) >>> 0;
      const out = this.heap.output(count * 4);
      this.m._cp_layout_measure(this.handle, 0, 0, -1, 0, 0, 0, out, count);
      return parseGaps(this.heap.readInts(out, count), 3, count);
    }
    return parseGaps(this.buffer, 2 * (this.last - this.first + 1) + 1, this.needed);
  }

  // Layout x for a view x.
  contentX(x: number): number {
    return x - this.textLeft;
  }

  // View x for a layout x.
  viewX(x: number): number {
    return x + this.textLeft;
  }

  firstVisibleLine(): number {
    return this.g(G.firstLine);
  }

  lastVisibleLine(): number {
    return this.g(G.lastLine);
  }

  // Smallest scroll that shows a rect in layout coordinates with the text padding around it.
  reveal(left: number, top: number, right: number, bottom: number): boolean {
    const out = this.heap.output(GEOMETRY_INTS * 4);
    const moved = this.m._cp_layout_reveal(this.handle, left, top, right, bottom, out) !== 0;
    this.moving(out, moved);
    return moved;
  }

  // Remembers the top visible line so a width or font change can put it back.
  anchor(): Anchor {
    const out = this.heap.output(8);
    this.m._cp_layout_anchor(this.handle, out, out + 4);
    const a = this.heap.readInts(out, 2);
    return { line: a[0] as number, offset: a[1] as number };
  }

  restore(anchor: Anchor): void {
    this.changing();
    this.m._cp_layout_restore(this.handle, anchor.line, anchor.offset);
  }

  // Records a measurement and raises the widest line to widest when not wrapping. A line above the viewport shifts
  // the scroll so the visible text stays put.
  measured(line: number, rows: number, widest = -1): void {
    if (this.drawing) {
      this.fill([line, rows], widest);
    } else {
      const pairs = this.heap.ints32(2);
      this.m.HEAP32.set([line, rows], pairs >> 2);
      this.m._cp_layout_measure(this.handle, pairs, 1, widest, 0, -1, 0, 0, 0);
    }
  }

  // Every line back to one row. Gaps stay.
  resetRows(): void {
    this.changing();
    this.m._cp_layout_reset_rows(this.handle);
  }

  // One measure call that refreshes the draw's copy, grown and repeated when the buffer is short. Applying the same
  // rows and widest line again changes nothing.
  private fill(pairs: number[], widest: number): void {
    const m = this.m;
    const pairPtr = this.heap.ints32(pairs.length);
    m.HEAP32.set(pairs, pairPtr >> 2);
    const geometry = this.heap.output(GEOMETRY_INTS * 4 + Math.max(this.buffer.length, 256) * 4);
    const outPtr = geometry + GEOMETRY_INTS * 4;
    let cap = Math.max(this.buffer.length, 256);
    let n =
      m._cp_layout_measure(
        this.handle,
        pairPtr,
        pairs.length / 2,
        widest,
        this.first,
        this.last,
        geometry,
        outPtr,
        cap,
      ) >>> 0;
    if (n > cap) {
      cap = n;
      const grown = this.heap.output(GEOMETRY_INTS * 4 + cap * 4);
      n =
        m._cp_layout_measure(
          this.handle,
          pairPtr,
          pairs.length / 2,
          widest,
          this.first,
          this.last,
          grown,
          grown + GEOMETRY_INTS * 4,
          cap,
        ) >>> 0;
      this.known = this.heap.readInts(grown, GEOMETRY_INTS);
      this.buffer = this.heap.readInts(grown + GEOMETRY_INTS * 4, cap);
    } else {
      this.known = this.heap.readInts(geometry, GEOMETRY_INTS);
      this.buffer = this.heap.readInts(outPtr, cap);
    }
    this.needed = n;
    this.cached = true;
  }

  private drawnTop(line: number): number | null {
    return this.cached && this.last >= this.first && line >= this.first && line <= this.last + 1
      ? (this.buffer[line - this.first] as number)
      : null;
  }

  private g(field: number): number {
    if (this.cached) return this.known[field] as number;
    const out = this.heap.output(GEOMETRY_INTS * 4);
    this.m._cp_layout_geometry(this.handle, out);
    return this.m.HEAP32[(out >> 2) + field] as number;
  }

  // A scroll inside a draw refreshes the geometry. Tops taken before a move are stale.
  private moving(out: number, moved: boolean): void {
    if (!this.drawing) return;
    this.known = this.heap.readInts(out, GEOMETRY_INTS);
    this.cached = true;
    if (moved) this.last = this.first - 1;
  }

  // A size, metric or row change has no place inside a draw: the copy would go stale.
  private changing(): void {
    if (!this.drawing) return;
    this.cached = false;
    this.last = this.first - 1;
  }

  private configure(): boolean {
    this.changing();
    const ptr = this.heap.ints32(CONFIG_INTS);
    this.m.HEAP32.set(this.config, ptr >> 2);
    return this.m._cp_layout_configure(this.handle, ptr) !== 0;
  }
}

function parseGaps(ints: Int32Array, start: number, end: number): Gap[] {
  const out: Gap[] = [];
  for (let i = start; i + 2 < end; i += 3) {
    out.push({ line: ints[i] as number, top: ints[i + 1] as number, rows: ints[i + 2] as number });
  }
  return out;
}
