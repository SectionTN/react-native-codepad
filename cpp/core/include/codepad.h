// The CodePad core's C API, shared by the Android JNI binding, the iOS Swift binding and later WASM.
// Offsets and lengths are UTF-16 code units. Ranges are half open. Lines and columns start at 0.
#ifndef CODEPAD_H
#define CODEPAD_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Empty on purpose: only bindings linked into the same library call the core, so nothing is exported.
#define CP_API

typedef uint16_t cp_unit;

typedef struct cp_language cp_language;
typedef struct cp_engine cp_engine;
typedef struct cp_snapshot cp_snapshot;

// The platform side of an engine. Every function runs with ctx.
// schedule runs work later on one serial worker off the main thread, and is a no-op once that worker is shut down.
// post_main runs work later on the main thread. resolve returns a language for an injection id, or NULL, on the worker.
typedef struct cp_host {
  void *ctx;
  void (*schedule)(void *ctx, void (*work)(void *), void *arg);
  void (*post_main)(void *ctx, void (*work)(void *), void *arg);
  int64_t (*now_micros)(void *ctx);
  const cp_language *(*resolve)(void *ctx, const char *id);
} cp_host;

typedef struct {
  int32_t line;
  int32_t column;
} cp_point;

// Languages. A loaded language lives as long as the process. Queries are UTF-8 bytes.
CP_API int32_t cp_abi_min(void);
CP_API int32_t cp_abi_max(void);
// NULL on failure, with a message naming the language and the error written to error.
CP_API cp_language *cp_language_load(const char *id, const void *ts_language, const char *highlights,
                                     uint32_t highlights_len, const char *injections, uint32_t injections_len,
                                     char *error, uint32_t error_cap);
CP_API const char *cp_language_id(const cp_language *language);

// An immutable view of a document's text, cheap to take and safe to read from any thread.
typedef struct cp_text cp_text;
// Returns a new handle on the same text, which the caller releases.
CP_API cp_text *cp_text_retain(const cp_text *text);
CP_API void cp_text_release(cp_text *text);
CP_API uint32_t cp_text_length(const cp_text *text);
// Copies [start, end), clamped to the text, and returns its full length.
CP_API uint32_t cp_text_copy(const cp_text *text, uint32_t start, uint32_t end, cp_unit *out, uint32_t cap);

// One editor: the document and, later, everything that edits it. Only the main thread writes to it.
typedef struct cp_editor cp_editor;
typedef struct {
  int32_t start;
  int32_t removed_len;
  int32_t inserted_len;
  int32_t revision;
} cp_change;

// Callbacks may be NULL. Both run on the writing thread after the document lock is released.
typedef struct cp_editor_host {
  void *ctx;
  int64_t (*now_millis)(void *ctx);
  // removed and inserted are valid during the call only.
  void (*on_change)(void *ctx, const cp_change *change, const cp_unit *removed, const cp_unit *inserted,
                    int32_t origin);
  void (*on_selection)(void *ctx, int32_t anchor, int32_t head);
} cp_editor_host;

// \r\n and a lone \r in text become \n.
CP_API cp_editor *cp_editor_new(const cp_editor_host *host, const cp_unit *text, uint32_t length);
CP_API void cp_editor_free(cp_editor *editor);

// The reads below run on the main thread, or on any thread between these two calls.
CP_API void cp_editor_lock_shared(cp_editor *editor);
CP_API void cp_editor_unlock_shared(cp_editor *editor);
CP_API uint32_t cp_doc_length(const cp_editor *editor);
CP_API int32_t cp_doc_revision(const cp_editor *editor);
CP_API int32_t cp_doc_line_count(const cp_editor *editor);
// Clamped to [0, line_count]. line_count gives length + 1, so starts are uniform prefix sums.
CP_API uint32_t cp_doc_line_start(const cp_editor *editor, int32_t line);
CP_API uint32_t cp_doc_line_end(const cp_editor *editor, int32_t line);
CP_API int32_t cp_doc_line_at(const cp_editor *editor, uint32_t offset);
// A line end, and any offset at or past the length, reads as \n.
CP_API cp_unit cp_doc_unit_at(const cp_editor *editor, uint32_t offset);
// Copies [start, end), clamped and ordered, and returns its full length.
CP_API uint32_t cp_doc_copy(const cp_editor *editor, uint32_t start, uint32_t end, cp_unit *out, uint32_t cap);
CP_API cp_point cp_doc_position(const cp_editor *editor, uint32_t offset);
CP_API uint32_t cp_doc_offset(const cp_editor *editor, int32_t line, int32_t column);
// The grapheme boundary after offset, or before it when forward is 0. A line break is a grapheme of its own.
CP_API uint32_t cp_doc_grapheme(const cp_editor *editor, uint32_t offset, int32_t forward);
// The current text, retained for the caller.
CP_API cp_text *cp_editor_text(cp_editor *editor);

// Editing, on the main thread unless marked. Text is normalized like cp_editor_new's.
enum { CP_ORIGIN_INPUT, CP_ORIGIN_API, CP_ORIGIN_UNDO, CP_ORIGIN_REDO };
enum { CP_MOVE_CHAR, CP_MOVE_WORD, CP_MOVE_LINE_START, CP_MOVE_LINE_END, CP_MOVE_DOC_START, CP_MOVE_DOC_END };
enum {
  CP_CMD_NEWLINE,
  CP_CMD_TAB,
  CP_CMD_SHIFT_TAB,
  CP_CMD_INDENT,
  CP_CMD_OUTDENT,
  CP_CMD_BACKSPACE,
  CP_CMD_DELETE,
  CP_CMD_UNDO,
  CP_CMD_REDO,
  CP_CMD_SELECT_ALL
};
typedef struct {
  int32_t tab_size;
  int32_t insert_spaces;
  int32_t auto_indent;
  int32_t auto_close;
} cp_settings;
// Underline: a start, b end. Gap: a line, b rows. Line background: a line. payload is the platform's index.
enum { CP_DECORATION_UNDERLINE, CP_DECORATION_GAP, CP_DECORATION_LINE_BACKGROUND };
typedef struct {
  int32_t kind;
  int32_t a;
  int32_t b;
  int32_t payload;
} cp_decoration;

CP_API void cp_editor_set_settings(cp_editor *editor, const cp_settings *settings);
// typing marks single key input that may coalesce in the history. caret_after puts a collapsed caret after
// the inserted text instead of mapping the selection through the edit.
CP_API void cp_editor_replace(cp_editor *editor, uint32_t start, uint32_t end, const cp_unit *text, uint32_t length,
                              int32_t origin, int32_t typing, int32_t caret_after);
CP_API void cp_editor_set_text(cp_editor *editor, const cp_unit *text, uint32_t length, int32_t keep_history);
// Replaces the selection and leaves the caret after the text.
CP_API void cp_editor_insert(cp_editor *editor, const cp_unit *text, uint32_t length, int32_t origin);
// One code point at a time, through auto close and auto indent.
CP_API void cp_editor_type(cp_editor *editor, const cp_unit *text, uint32_t length);
// Returns 1 when undo or redo did something.
CP_API int32_t cp_editor_command(cp_editor *editor, int32_t command);
CP_API void cp_editor_set_selection(cp_editor *editor, int32_t anchor, int32_t head);
CP_API void cp_editor_move(cp_editor *editor, int32_t unit, int32_t forward, int32_t extend);
CP_API void cp_editor_select_word_at(cp_editor *editor, uint32_t offset);
// 1 when a backspace at caret sits between an empty pair the auto closer removes together.
CP_API int32_t cp_editor_deletes_pair(const cp_editor *editor, uint32_t caret);
// Several edits as one undo step. Groups nest.
CP_API void cp_editor_begin_group(cp_editor *editor);
CP_API void cp_editor_end_group(cp_editor *editor);
// 1 when the selection moved for a reason other than an edit, so the next typed unit starts a new undo step.
CP_API int32_t cp_editor_selection_dirty(const cp_editor *editor);
CP_API void cp_editor_set_selection_dirty(cp_editor *editor, int32_t dirty);
// Any thread: anchor in the high 32 bits, head in the low ones.
CP_API int64_t cp_editor_selection(const cp_editor *editor);
// Any thread: bit 0 can undo, bit 1 can redo.
CP_API int32_t cp_editor_history(const cp_editor *editor);
// The bracket at caret and its partner, 1 when found. snapshot NULL or at another revision than the
// document: every bracket counts. Otherwise brackets in strings and comments are skipped.
CP_API int32_t cp_editor_bracket_match(const cp_editor *editor, const cp_snapshot *snapshot, uint32_t caret,
                                       int32_t out[2]);
// Main thread. The engine parses the editor's current text, then every later edit, reading the document's own
// chunks with no copy. NULL detaches. A snapshot parsed before the latest attach never reaches on_snapshot.
CP_API void cp_editor_attach(cp_editor *editor, cp_engine *engine);
// revision is the document revision the items were computed for, below zero for the current one. Returns 0
// when the edits since then are no longer known, which keeps the current set.
CP_API int32_t cp_editor_set_decorations(cp_editor *editor, const cp_decoration *items, uint32_t count,
                                         int32_t revision);
// Copies up to cap items and returns the count.
CP_API uint32_t cp_editor_decorations(const cp_editor *editor, cp_decoration *out, uint32_t cap);
// Moves whenever the decorations change.
CP_API int32_t cp_editor_decorations_version(const cp_editor *editor);

// Search, a PCRE2 regex or plain text, in Unicode mode with any newline ending a line. Empty matches are skipped.
typedef struct cp_search cp_search;
enum { CP_SEARCH_REGEX = 1, CP_SEARCH_CASE = 2, CP_SEARCH_WORD = 4 };
// Returns 0 with PCRE2's message in error when the regex does not compile, which also clears the search.
CP_API int32_t cp_editor_set_search(cp_editor *editor, const cp_unit *query, uint32_t length, int32_t flags,
                                    char *error, uint32_t error_cap);
CP_API void cp_editor_clear_search(cp_editor *editor);
CP_API int32_t cp_editor_search_active(const cp_editor *editor);
// 1 while a query is active and its matches belong to an older revision.
CP_API int32_t cp_editor_search_stale(const cp_editor *editor);
CP_API int32_t cp_editor_match_count(const cp_editor *editor);
// The matches as start and end pairs, computed on the calling thread when stale. Returns the ints there are.
CP_API uint32_t cp_editor_matches(cp_editor *editor, int32_t *out, uint32_t cap);
// Selects the next match, or the previous one when forward is 0. Returns 0 without a match.
CP_API int32_t cp_editor_find(cp_editor *editor, int32_t forward, int32_t *index, int32_t *total);
CP_API int32_t cp_editor_replace_current(cp_editor *editor, const cp_unit *text, uint32_t length);
// Returns how many matches were replaced, as one undo step.
CP_API int32_t cp_editor_replace_all(cp_editor *editor, const cp_unit *text, uint32_t length);
// Matches computed off the main thread for revision. count is in ints. Returns 0 when the document moved on.
CP_API int32_t cp_editor_accept_matches(cp_editor *editor, int32_t revision, const int32_t *pairs, uint32_t count);
// The compiled query, retained for the caller, or NULL without a search.
CP_API cp_search *cp_editor_search_query(cp_editor *editor);
// One scan of a query over a text, carried across cp_search_find calls. Start with next 0, or the offset to scan
// from, and budget_ms as how long one call may run (0 runs to the end).
typedef struct cp_search_scan {
  int32_t next;
  int32_t limited;
  uint32_t budget_ms;
} cp_search_scan;
// Any thread. Writes up to cap / 2 match pairs from scan->next on, returns the ints written and moves next to where
// the next call resumes, or to -1 at the end of the text. limited is set when a match attempt hit PCRE2's match
// limit, which ends the scan. A call stops once its budget is spent, so the caller can check for a cancel.
CP_API int32_t cp_search_find(const cp_search *search, cp_text *text, cp_search_scan *scan, int32_t *out, uint32_t cap);
CP_API void cp_search_release(cp_search *search);

// Capture names interned into small ids shared by every language.
CP_API int32_t cp_style_id(const char *name);
// Writes the name NUL terminated when it fits and returns its full length.
CP_API uint32_t cp_style_name(int32_t id, char *out, uint32_t cap);

// The parse engine. on_snapshot runs through post_main with host->ctx, and the receiver owns the snapshot
// until cp_engine_release. The host is copied, and host->ctx must stay valid until the last post_main runs:
// the engine posts one final call after cp_engine_close, with a NULL snapshot, after which ctx may be freed.
CP_API cp_engine *cp_engine_new(const cp_host *host, int64_t budget_micros,
                                void (*on_snapshot)(void *ctx, cp_snapshot *snapshot));
// NULL clears the language. A snapshot still in flight keeps the language it was parsed with.
CP_API void cp_engine_set_language(cp_engine *engine, const cp_language *language);
// Frees the snapshot on the worker, or on the calling thread once the engine is closed. engine may be NULL then.
CP_API void cp_engine_release(cp_engine *engine, cp_snapshot *snapshot);
// No engine work runs after it. The engine frees itself on the worker.
CP_API void cp_engine_close(cp_engine *engine);

typedef struct {
  int32_t revision;
  int32_t based_on;
  int32_t latency_ms;
  int32_t fresh;
  int32_t reused;
  int32_t carried;
  uint32_t changed_len;
} cp_snapshot_info;

// A snapshot keeps the text it was parsed from, so reading it never touches the engine.
CP_API void cp_snapshot_info_get(const cp_snapshot *snapshot, cp_snapshot_info *out);
// Sorted, coalesced unit pairs relative to based_on, changed_len ints.
CP_API const int32_t *cp_snapshot_changed(const cp_snapshot *snapshot);
CP_API const cp_language *cp_snapshot_language(const cp_snapshot *snapshot);
CP_API uint32_t cp_snapshot_length(const cp_snapshot *snapshot);

// The injected trees of a snapshot, sorted by start. ranges is how many ranges the tree covers.
typedef struct {
  const cp_language *language;
  int32_t start;
  int32_t end;
  int32_t shift;
  uint32_t ranges;
} cp_injected_info;
CP_API uint32_t cp_snapshot_injected_count(const cp_snapshot *snapshot);
CP_API void cp_snapshot_injected_get(const cp_snapshot *snapshot, uint32_t index, cp_injected_info *out);

// Highlighting writes runs of ints and returns how many it needs. A short buffer gets nothing written,
// and the caller retries with at least the returned size.
// cp_highlight: for each line of [first_line, last_line], its triple count then its
// (startColumn, endColumn, styleId) triples. first_line_start is the document offset of first_line.
CP_API uint32_t cp_highlight(const cp_snapshot *snapshot, int32_t first_line, int32_t last_line,
                             uint32_t first_line_start, int32_t *out, uint32_t cap);
enum { CP_NO_ENTRY = -2147483647 - 1 };
// Main thread, one call per draw over lines [first_line, last_line] clamped to the document. entry_revisions[i] is
// the cached revision of line first_line + i: CP_NO_ENTRY without one, -1 for a line laid out plain. use_changed
// is 1 when the snapshot is based on applied_revision. out receives, in order:
//   a header: revision, length, line_count, anchor, head, caret_line, decorations_version, history
//   the line starts of the clamped first..last + 1 (line_count gives length + 1)
//   the dirty runs: run_count, run_count inclusive (lo, hi) pairs, then for each line of each run its spans as
//   cp_highlight. snapshot NULL or at another revision than the document: the runs are the lines with no entry
//   and every span count is 0
//   for each line of each run, its text's offset and length in text_out
// Returns the ints needed and sets *text_len to the units needed. Nothing is written unless both fit.
CP_API uint32_t cp_editor_frame(const cp_editor *editor, const cp_snapshot *snapshot, int32_t first_line,
                                int32_t last_line, int32_t applied_revision, int32_t use_changed,
                                const int32_t *entry_revisions, int32_t *out, uint32_t cap, cp_unit *text_out,
                                uint32_t text_cap, uint32_t *text_len);
// A line's triples after an edit inside it replaced removed units at start with inserted units.
CP_API uint32_t cp_shift_spans(const int32_t *spans, uint32_t count, int32_t start, int32_t removed,
                               int32_t inserted, int32_t *out, uint32_t cap);

#ifdef CODEPAD_TEST_HOOKS
// Parses source with the language, runs query over the whole tree and returns how many matches pass their
// predicates, or -1 with a message in error when the query does not compile.
CP_API int32_t cp_test_predicate(const cp_language *language, const char *query, uint32_t query_len,
                                 const cp_unit *source, uint32_t source_len, char *error, uint32_t error_cap);
// The dirty runs of cp_editor_frame over text whose line first_line starts at first_line_start, with any revision
// and regions. changed_len -1 means no regions.
CP_API uint32_t cp_test_dirty_runs(const cp_unit *text, uint32_t length, uint32_t first_line_start,
                                   int32_t first_line, int32_t last_line, int32_t revision, int32_t applied,
                                   const int32_t *changed, int32_t changed_len, const int32_t *entry_revisions,
                                   int32_t *out, uint32_t cap);
CP_API uint32_t cp_test_coalesce(const int32_t *pairs, uint32_t count, int32_t *out, uint32_t cap);
// The snapshot's host tree as an S-expression, written NUL terminated when it fits. Returns its full length.
CP_API uint32_t cp_test_tree_string(const cp_snapshot *snapshot, char *out, uint32_t cap);
// Every extended grapheme cluster boundary in text, 0 and length included. Returns the count.
CP_API uint32_t cp_test_grapheme_breaks(const cp_unit *text, uint32_t length, uint32_t *out, uint32_t cap);
// The same boundaries found by stepping back from length, so in descending order.
CP_API uint32_t cp_test_grapheme_breaks_backward(const cp_unit *text, uint32_t length, uint32_t *out, uint32_t cap);
CP_API int32_t cp_test_white_space(uint32_t code_point);
// The end offset of every chunk of the editor's text. Returns the chunk count.
CP_API uint32_t cp_test_chunk_ends(cp_editor *editor, uint32_t *out, uint32_t cap);
// Units copied out of existing chunks since the last call.
CP_API uint32_t cp_test_units_copied(cp_editor *editor);
// Chunk size limits for later edits and new documents. 0, 0 restores the defaults.
CP_API void cp_test_set_chunk_limits(uint32_t max, uint32_t min);
// Takes the document's exclusive lock, or releases it, on the calling thread.
CP_API void cp_test_hold_write(cp_editor *editor, int32_t hold);
// Snapshots the engine made that are not freed yet.
CP_API int32_t cp_test_live_snapshots(const cp_engine *engine);
#endif

#ifdef __cplusplus
}
#endif

#endif
