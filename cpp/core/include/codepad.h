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
CP_API void cp_engine_set_text(cp_engine *engine, const cp_unit *text, uint32_t length, int32_t revision);
// Points are in UTF-16 units, as the platform document computes them.
CP_API void cp_engine_edit(cp_engine *engine, uint32_t start, uint32_t removed, const cp_unit *inserted,
                           uint32_t inserted_len, int32_t revision, cp_point start_point, cp_point old_end,
                           cp_point new_end);
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
// cp_frame: the dirty runs of [first_line, last_line] then their spans, for one draw. entry_revisions[i] is the
// cached revision of line first_line + i: CP_NO_ENTRY without one, -1 for a line laid out plain. use_changed is 1
// when the snapshot is based on applied_revision. Layout: run_count, run_count inclusive (lo, hi) pairs, then for
// each line of each run as cp_highlight.
enum { CP_NO_ENTRY = -2147483647 - 1 };
CP_API uint32_t cp_frame(const cp_snapshot *snapshot, int32_t first_line, int32_t last_line,
                         uint32_t first_line_start, int32_t applied_revision, int32_t use_changed,
                         const int32_t *entry_revisions, int32_t *out, uint32_t cap);
// A line's triples after an edit inside it replaced removed units at start with inserted units.
CP_API uint32_t cp_shift_spans(const int32_t *spans, uint32_t count, int32_t start, int32_t removed,
                               int32_t inserted, int32_t *out, uint32_t cap);

#ifdef CODEPAD_TEST_HOOKS
// Parses source with the language, runs query over the whole tree and returns how many matches pass their
// predicates, or -1 with a message in error when the query does not compile.
CP_API int32_t cp_test_predicate(const cp_language *language, const char *query, uint32_t query_len,
                                 const cp_unit *source, uint32_t source_len, char *error, uint32_t error_cap);
// The dirty runs of cp_frame over text whose line first_line starts at first_line_start, with any revision
// and regions. changed_len -1 means no regions.
CP_API uint32_t cp_test_dirty_runs(const cp_unit *text, uint32_t length, uint32_t first_line_start,
                                   int32_t first_line, int32_t last_line, int32_t revision, int32_t applied,
                                   const int32_t *changed, int32_t changed_len, const int32_t *entry_revisions,
                                   int32_t *out, uint32_t cap);
CP_API uint32_t cp_test_coalesce(const int32_t *pairs, uint32_t count, int32_t *out, uint32_t cap);
#endif

#ifdef __cplusplus
}
#endif

#endif
