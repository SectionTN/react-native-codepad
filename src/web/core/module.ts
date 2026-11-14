// The Emscripten module built by cpp/web/build.sh, typed by hand: the package never imports the glue.

type Ptr = number;

export interface CoreModule {
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    createPreloadedFile(
      parent: string,
      name: string,
      url: string | Uint8Array,
      canRead: boolean,
      canWrite: boolean,
      onload?: () => void,
      onerror?: () => void,
    ): void;
  };
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAP32: Int32Array;
  _malloc(size: number): Ptr;
  _free(ptr: Ptr): void;
  stringToNewUTF8(s: string): Ptr;
  UTF8ToString(ptr: Ptr, maxBytes?: number): string;

  _cpw_error(): Ptr;
  _cpw_language_load(id: Ptr, path: Ptr, symbol: Ptr, highlights: Ptr, injections: Ptr): number;
  _cpw_language_alias(name: Ptr, id: Ptr): void;
  _cpw_open(text: Ptr, length: number, budgetMicros: bigint): number;
  _cpw_close(e: number): void;
  _cpw_set_language(e: number, id: Ptr): number;
  _cpw_editor(e: number): Ptr;
  _cpw_layout(e: number): Ptr;
  _cpw_snapshot(e: number): Ptr;
  _cpw_snapshot_count(e: number): number;
  _cpw_set_clock(e: number, millis: number): void;
  _cpw_pump(budgetMs: number): number;
  _cpw_take_changes(
    e: number,
    out: Ptr,
    cap: number,
    text: Ptr,
    textCap: number,
    textLen: Ptr,
  ): number;
  _cpw_test_held_snapshots(): number;
  _cpw_test_slots(): number;

  _cp_doc_length(ed: Ptr): number;
  _cp_doc_revision(ed: Ptr): number;
  _cp_doc_line_count(ed: Ptr): number;
  _cp_doc_line_start(ed: Ptr, line: number): number;
  _cp_doc_line_end(ed: Ptr, line: number): number;
  _cp_doc_line_at(ed: Ptr, offset: number): number;
  _cp_doc_copy(ed: Ptr, start: number, end: number, out: Ptr, cap: number): number;
  // Structs come back through a pointer passed first.
  _cp_doc_position(out: Ptr, ed: Ptr, offset: number): void;
  _cp_doc_offset(ed: Ptr, line: number, column: number): number;
  _cp_editor_set_settings(ed: Ptr, settings: Ptr): void;
  _cp_editor_replace(
    ed: Ptr,
    start: number,
    end: number,
    text: Ptr,
    length: number,
    origin: number,
    typing: number,
    caretAfter: number,
  ): void;
  _cp_editor_set_text(ed: Ptr, text: Ptr, length: number, keepHistory: number): void;
  _cp_editor_insert(ed: Ptr, text: Ptr, length: number, origin: number): void;
  _cp_editor_type(ed: Ptr, text: Ptr, length: number): void;
  _cp_editor_command(ed: Ptr, command: number): number;
  _cp_editor_set_selection(ed: Ptr, anchor: number, head: number): void;
  _cp_editor_move(ed: Ptr, unit: number, forward: number, extend: number): void;
  _cp_editor_select_word_at(ed: Ptr, offset: number): void;
  _cp_editor_selection(ed: Ptr): bigint;
  _cp_editor_history(ed: Ptr): number;
  _cp_editor_bracket_match(ed: Ptr, snapshot: Ptr, caret: number, out: Ptr): number;
  _cp_editor_set_decorations(ed: Ptr, items: Ptr, count: number, revision: number): number;
  _cp_editor_decorations(ed: Ptr, out: Ptr, cap: number): number;
  _cp_editor_decorations_version(ed: Ptr): number;
  _cp_editor_set_search(
    ed: Ptr,
    query: Ptr,
    length: number,
    flags: number,
    error: Ptr,
    errorCap: number,
  ): number;
  _cp_editor_clear_search(ed: Ptr): void;
  _cp_editor_search_active(ed: Ptr): number;
  _cp_editor_search_stale(ed: Ptr): number;
  _cp_editor_match_count(ed: Ptr): number;
  _cp_editor_match_limited(ed: Ptr): number;
  _cp_editor_matches(ed: Ptr, out: Ptr, cap: number): number;
  _cp_editor_find(ed: Ptr, forward: number, index: Ptr, total: Ptr): number;
  _cp_editor_replace_current(ed: Ptr, text: Ptr, length: number): number;
  _cp_editor_replace_all(ed: Ptr, text: Ptr, length: number): number;

  _cp_layout_configure(layout: Ptr, config: Ptr): number;
  _cp_layout_geometry(layout: Ptr, out: Ptr): void;
  _cp_layout_scroll_to(layout: Ptr, x: number, y: number, out: Ptr): number;
  _cp_layout_reveal(
    layout: Ptr,
    left: number,
    top: number,
    right: number,
    bottom: number,
    out: Ptr,
  ): number;
  _cp_layout_measure(
    layout: Ptr,
    pairs: Ptr,
    pairCount: number,
    widest: number,
    first: number,
    last: number,
    out: Ptr,
    topsRows: Ptr,
    cap: number,
  ): number;
  _cp_layout_set_widest(layout: Ptr, widest: number): void;
  _cp_layout_rows(layout: Ptr, line: number): number;
  _cp_layout_gap_rows(layout: Ptr, line: number): number;
  _cp_layout_row_start(layout: Ptr, line: number): number;
  _cp_layout_line_at_row(layout: Ptr, row: number): number;
  _cp_layout_is_gap_row(layout: Ptr, row: number): number;
  _cp_layout_row_top(layout: Ptr, row: number): number;
  _cp_layout_line_top(layout: Ptr, line: number): number;
  _cp_layout_row_at(layout: Ptr, y: number): number;
  _cp_layout_anchor(layout: Ptr, line: Ptr, offset: Ptr): void;
  _cp_layout_restore(layout: Ptr, line: number, offset: number): number;
  _cp_layout_reset_rows(layout: Ptr): void;
  _cp_editor_attach_layout(ed: Ptr, layout: Ptr): void;

  _cp_highlight(
    snapshot: Ptr,
    first: number,
    last: number,
    firstLineStart: number,
    out: Ptr,
    cap: number,
  ): number;
  _cp_editor_frame(
    ed: Ptr,
    layout: Ptr,
    snapshot: Ptr,
    appliedRevision: number,
    useChanged: number,
    entries: Ptr,
    entryCount: number,
    out: Ptr,
    cap: number,
    text: Ptr,
    textCap: number,
    textLen: Ptr,
  ): number;
  _cp_shift_spans(
    spans: Ptr,
    count: number,
    start: number,
    removed: number,
    inserted: number,
    out: Ptr,
    cap: number,
  ): number;
  _cp_snapshot_length(snapshot: Ptr): number;
  // revision, based_on, latency_ms, fresh, reused, carried, changed_len
  _cp_snapshot_info_get(snapshot: Ptr, out: Ptr): void;
  _cp_style_id(name: Ptr): number;
  _cp_style_name(id: number, out: Ptr, cap: number): number;
}

const decoder = new TextDecoder('utf-16le');

// Grows on demand, one region per use. Callers never hold a region across another call that takes the same one.
class Region {
  ptr = 0;
  bytes = 0;

  constructor(private readonly m: CoreModule) {}

  take(bytes: number): number {
    if (bytes > this.bytes) {
      if (this.ptr) this.m._free(this.ptr);
      this.bytes = Math.max(bytes, this.bytes * 2, 256);
      this.ptr = this.m._malloc(this.bytes);
    }
    return this.ptr;
  }
}

// Scratch memory in the module's heap, shared by every editor on the page.
export class Heap {
  private readonly text: Region;
  private readonly ints: Region;
  private readonly out: Region;

  constructor(readonly m: CoreModule) {
    this.text = new Region(m);
    this.ints = new Region(m);
    this.out = new Region(m);
  }

  // Writes s as UTF-16 units and returns its pointer.
  units(s: string): number {
    const ptr = this.text.take(s.length * 2 + 2);
    const heap = this.m.HEAPU16;
    const base = ptr >> 1;
    for (let i = 0; i < s.length; i++) heap[base + i] = s.charCodeAt(i);
    return ptr;
  }

  // A region of count int32s for inputs, zeroed.
  ints32(count: number): number {
    const ptr = this.ints.take(Math.max(1, count) * 4);
    this.m.HEAP32.fill(0, ptr >> 2, (ptr >> 2) + Math.max(1, count));
    return ptr;
  }

  // A region of bytes for outputs.
  output(bytes: number): number {
    return this.out.take(Math.max(4, bytes));
  }

  readUnits(ptr: number, length: number): string {
    if (length <= 0) return '';
    return decoder.decode(this.m.HEAPU16.subarray(ptr >> 1, (ptr >> 1) + length));
  }

  readInts(ptr: number, count: number): Int32Array<ArrayBuffer> {
    return Int32Array.from(this.m.HEAP32.subarray(ptr >> 2, (ptr >> 2) + count));
  }
}

const heaps = new WeakMap<CoreModule, Heap>();

export function heapOf(m: CoreModule): Heap {
  let heap = heaps.get(m);
  if (!heap) {
    heap = new Heap(m);
    heaps.set(m, heap);
  }
  return heap;
}

// Runs use with s as a NUL terminated UTF-8 string in the heap.
export function withCString<T>(m: CoreModule, s: string, use: (ptr: number) => T): T {
  const ptr = m.stringToNewUTF8(s);
  try {
    return use(ptr);
  } finally {
    m._free(ptr);
  }
}
