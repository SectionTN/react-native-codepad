// clock_gettime needs POSIX visibility under -std=c11 on glibc.
#ifndef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE 200809L
#endif

#include <jni.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <tree_sitter/api.h>

#include "utf16_mirror.h"

#define FN(name) JNIEXPORT JNICALL Java_me_sectiontn_codepad_syntax_TreeSitterNative_##name

// Every offset crossing this boundary is a UTF-16 unit. Tree-sitter counts bytes, so the x2 and /2 happen here.
#define U(bytes) ((jint) ((bytes) / 2))
#define B(units) ((uint32_t) (units) * 2u)

typedef struct {
  TSQueryCursor *cursor;
  TSQueryMatch match;
} Cursor;

typedef struct {
  volatile int *flag;
  int64_t deadline_ns;
} ParseCtx;

static int64_t now_ns(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (int64_t) ts.tv_sec * 1000000000LL + ts.tv_nsec;
}

static void node_out(JNIEnv *env, TSNode node, jlongArray out) {
  jlong v[4];
  v[0] = ((jlong) node.context[0] << 32) | (jlong) node.context[1];
  v[1] = ((jlong) node.context[2] << 32) | (jlong) node.context[3];
  v[2] = (jlong) (intptr_t) node.id;
  v[3] = (jlong) (intptr_t) node.tree;
  (*env)->SetLongArrayRegion(env, out, 0, 4, v);
}

static TSNode node_in(JNIEnv *env, jlongArray in) {
  jlong v[4];
  (*env)->GetLongArrayRegion(env, in, 0, 4, v);
  TSNode node;
  node.context[0] = (uint32_t) ((uint64_t) v[0] >> 32);
  node.context[1] = (uint32_t) v[0];
  node.context[2] = (uint32_t) ((uint64_t) v[1] >> 32);
  node.context[3] = (uint32_t) v[1];
  node.id = (const void *) (intptr_t) v[2];
  node.tree = (const TSTree *) (intptr_t) v[3];
  return node;
}

static jlong pack_point(TSPoint p) {
  return ((jlong) p.row << 32) | (jlong) (p.column / 2);
}

static jstring jstring_n(JNIEnv *env, const char *s, uint32_t len) {
  char *buf = malloc(len + 1);
  memcpy(buf, s, len);
  buf[len] = 0;
  jstring out = (*env)->NewStringUTF(env, buf);
  free(buf);
  return out;
}

/* parser */

jlong FN(parserNew)(JNIEnv *env, jclass cls) {
  (void) env; (void) cls;
  return (jlong) (intptr_t) ts_parser_new();
}

void FN(parserDelete)(JNIEnv *env, jclass cls, jlong parser) {
  (void) env; (void) cls;
  ts_parser_delete((TSParser *) (intptr_t) parser);
}

jboolean FN(parserSetLanguage)(JNIEnv *env, jclass cls, jlong parser, jlong language) {
  (void) env; (void) cls;
  return ts_parser_set_language((TSParser *) (intptr_t) parser, (const TSLanguage *) (intptr_t) language) ? JNI_TRUE : JNI_FALSE;
}

void FN(parserReset)(JNIEnv *env, jclass cls, jlong parser) {
  (void) env; (void) cls;
  ts_parser_reset((TSParser *) (intptr_t) parser);
}

// ranges: 6 ints per range in units: start, end, startRow, startCol, endRow, endCol. null or empty clears.
jboolean FN(parserSetIncludedRanges)(JNIEnv *env, jclass cls, jlong parser, jintArray ranges) {
  (void) cls;
  TSParser *p = (TSParser *) (intptr_t) parser;
  if (!ranges) return ts_parser_set_included_ranges(p, NULL, 0) ? JNI_TRUE : JNI_FALSE;
  jsize n = (*env)->GetArrayLength(env, ranges) / 6;
  if (n == 0) return ts_parser_set_included_ranges(p, NULL, 0) ? JNI_TRUE : JNI_FALSE;
  jint *v = (*env)->GetIntArrayElements(env, ranges, NULL);
  TSRange *rs = malloc(sizeof(TSRange) * n);
  for (jsize i = 0; i < n; i++) {
    const jint *r = v + i * 6;
    rs[i].start_byte = B(r[0]);
    rs[i].end_byte = B(r[1]);
    rs[i].start_point = (TSPoint) { (uint32_t) r[2], B(r[3]) };
    rs[i].end_point = (TSPoint) { (uint32_t) r[4], B(r[5]) };
  }
  bool ok = ts_parser_set_included_ranges(p, rs, (uint32_t) n);
  free(rs);
  (*env)->ReleaseIntArrayElements(env, ranges, v, JNI_ABORT);
  return ok ? JNI_TRUE : JNI_FALSE;
}

static const char *read_mirror(void *payload, uint32_t byte_index, TSPoint position, uint32_t *bytes_read) {
  (void) position;
  Mirror *m = payload;
  uint32_t total = m->length * 2;
  if (byte_index >= total) {
    *bytes_read = 0;
    return "";
  }
  *bytes_read = total - byte_index;
  return (const char *) m->data + byte_index;
}

static bool parse_progress(TSParseState *state) {
  ParseCtx *ctx = state->payload;
  if (ctx->flag && *ctx->flag) return true;
  return ctx->deadline_ns > 0 && now_ns() >= ctx->deadline_ns;
}

// Returns 0 when the flag or the budget cancelled the parse. Call again to resume, or reset first.
jlong FN(parserParse)(JNIEnv *env, jclass cls, jlong parser, jlong old_tree, jlong mirror, jlong flag, jlong budget_micros) {
  (void) env; (void) cls;
  TSInput input;
  input.payload = (Mirror *) (intptr_t) mirror;
  input.read = read_mirror;
  input.encoding = TSInputEncodingUTF16LE;
  input.decode = NULL;
  ParseCtx ctx;
  ctx.flag = (volatile int *) (intptr_t) flag;
  ctx.deadline_ns = budget_micros > 0 ? now_ns() + budget_micros * 1000 : 0;
  TSParseOptions opts;
  opts.payload = &ctx;
  opts.progress_callback = parse_progress;
  TSTree *tree = ts_parser_parse_with_options((TSParser *) (intptr_t) parser, (const TSTree *) (intptr_t) old_tree, input, opts);
  return (jlong) (intptr_t) tree;
}

jlong FN(flagNew)(JNIEnv *env, jclass cls) {
  (void) env; (void) cls;
  return (jlong) (intptr_t) calloc(1, sizeof(int));
}

void FN(flagSet)(JNIEnv *env, jclass cls, jlong flag, jboolean value) {
  (void) env; (void) cls;
  *(volatile int *) (intptr_t) flag = value ? 1 : 0;
}

void FN(flagDelete)(JNIEnv *env, jclass cls, jlong flag) {
  (void) env; (void) cls;
  free((void *) (intptr_t) flag);
}

/* tree */

void FN(treeDelete)(JNIEnv *env, jclass cls, jlong tree) {
  (void) env; (void) cls;
  ts_tree_delete((TSTree *) (intptr_t) tree);
}

jlong FN(treeCopy)(JNIEnv *env, jclass cls, jlong tree) {
  (void) env; (void) cls;
  return (jlong) (intptr_t) ts_tree_copy((const TSTree *) (intptr_t) tree);
}

void FN(treeRootNode)(JNIEnv *env, jclass cls, jlong tree, jlongArray out) {
  (void) cls;
  node_out(env, ts_tree_root_node((const TSTree *) (intptr_t) tree), out);
}

void FN(treeEdit)(JNIEnv *env, jclass cls, jlong tree, jint start, jint old_end, jint new_end,
                  jint start_row, jint start_col, jint old_end_row, jint old_end_col, jint new_end_row, jint new_end_col) {
  (void) env; (void) cls;
  TSInputEdit edit;
  edit.start_byte = B(start);
  edit.old_end_byte = B(old_end);
  edit.new_end_byte = B(new_end);
  edit.start_point = (TSPoint) { (uint32_t) start_row, B(start_col) };
  edit.old_end_point = (TSPoint) { (uint32_t) old_end_row, B(old_end_col) };
  edit.new_end_point = (TSPoint) { (uint32_t) new_end_row, B(new_end_col) };
  ts_tree_edit((TSTree *) (intptr_t) tree, &edit);
}

jintArray FN(treeChangedRanges)(JNIEnv *env, jclass cls, jlong old_tree, jlong new_tree) {
  (void) cls;
  uint32_t count = 0;
  TSRange *ranges = ts_tree_get_changed_ranges((const TSTree *) (intptr_t) old_tree, (const TSTree *) (intptr_t) new_tree, &count);
  jintArray out = (*env)->NewIntArray(env, (jsize) count * 2);
  if (count) {
    jint *v = malloc(sizeof(jint) * count * 2);
    for (uint32_t i = 0; i < count; i++) {
      v[i * 2] = U(ranges[i].start_byte);
      v[i * 2 + 1] = U(ranges[i].end_byte);
    }
    (*env)->SetIntArrayRegion(env, out, 0, (jsize) count * 2, v);
    free(v);
  }
  free(ranges);
  return out;
}

jintArray FN(treeIncludedRanges)(JNIEnv *env, jclass cls, jlong tree) {
  (void) cls;
  uint32_t count = 0;
  TSRange *ranges = ts_tree_included_ranges((const TSTree *) (intptr_t) tree, &count);
  jintArray out = (*env)->NewIntArray(env, (jsize) count * 6);
  if (count) {
    jint *v = malloc(sizeof(jint) * count * 6);
    for (uint32_t i = 0; i < count; i++) {
      v[i * 6] = U(ranges[i].start_byte);
      v[i * 6 + 1] = U(ranges[i].end_byte);
      v[i * 6 + 2] = (jint) ranges[i].start_point.row;
      v[i * 6 + 3] = U(ranges[i].start_point.column);
      v[i * 6 + 4] = (jint) ranges[i].end_point.row;
      v[i * 6 + 5] = U(ranges[i].end_point.column);
    }
    (*env)->SetIntArrayRegion(env, out, 0, (jsize) count * 6, v);
    free(v);
  }
  free(ranges);
  return out;
}

/* node */

jboolean FN(nodeIsNull)(JNIEnv *env, jclass cls, jlongArray node) {
  (void) cls;
  return ts_node_is_null(node_in(env, node)) ? JNI_TRUE : JNI_FALSE;
}

jint FN(nodeStartUnit)(JNIEnv *env, jclass cls, jlongArray node) {
  (void) cls;
  return U(ts_node_start_byte(node_in(env, node)));
}

jint FN(nodeEndUnit)(JNIEnv *env, jclass cls, jlongArray node) {
  (void) cls;
  return U(ts_node_end_byte(node_in(env, node)));
}

jlong FN(nodeStartPoint)(JNIEnv *env, jclass cls, jlongArray node) {
  (void) cls;
  return pack_point(ts_node_start_point(node_in(env, node)));
}

jlong FN(nodeEndPoint)(JNIEnv *env, jclass cls, jlongArray node) {
  (void) cls;
  return pack_point(ts_node_end_point(node_in(env, node)));
}

jstring FN(nodeType)(JNIEnv *env, jclass cls, jlongArray node) {
  (void) cls;
  return (*env)->NewStringUTF(env, ts_node_type(node_in(env, node)));
}

void FN(nodeParent)(JNIEnv *env, jclass cls, jlongArray node, jlongArray out) {
  (void) cls;
  node_out(env, ts_node_parent(node_in(env, node)), out);
}

jint FN(nodeChildCount)(JNIEnv *env, jclass cls, jlongArray node) {
  (void) cls;
  return (jint) ts_node_child_count(node_in(env, node));
}

void FN(nodeChild)(JNIEnv *env, jclass cls, jlongArray node, jint index, jlongArray out) {
  (void) cls;
  node_out(env, ts_node_child(node_in(env, node), (uint32_t) index), out);
}

void FN(nodeDescendantForUnitRange)(JNIEnv *env, jclass cls, jlongArray node, jint start, jint end, jlongArray out) {
  (void) cls;
  node_out(env, ts_node_descendant_for_byte_range(node_in(env, node), B(start), B(end)), out);
}

/* query */

jlong FN(queryNew)(JNIEnv *env, jclass cls, jlong language, jstring source, jintArray error) {
  (void) cls;
  const char *src = (*env)->GetStringUTFChars(env, source, NULL);
  uint32_t offset = 0;
  TSQueryError type = TSQueryErrorNone;
  TSQuery *q = ts_query_new((const TSLanguage *) (intptr_t) language, src, (uint32_t) strlen(src), &offset, &type);
  (*env)->ReleaseStringUTFChars(env, source, src);
  jint err[2] = { (jint) offset, (jint) type };
  (*env)->SetIntArrayRegion(env, error, 0, 2, err);
  return (jlong) (intptr_t) q;
}

void FN(queryDelete)(JNIEnv *env, jclass cls, jlong query) {
  (void) env; (void) cls;
  ts_query_delete((TSQuery *) (intptr_t) query);
}

jint FN(queryPatternCount)(JNIEnv *env, jclass cls, jlong query) {
  (void) env; (void) cls;
  return (jint) ts_query_pattern_count((const TSQuery *) (intptr_t) query);
}

jobjectArray FN(queryCaptureNames)(JNIEnv *env, jclass cls, jlong query) {
  (void) cls;
  const TSQuery *q = (const TSQuery *) (intptr_t) query;
  uint32_t n = ts_query_capture_count(q);
  jobjectArray out = (*env)->NewObjectArray(env, (jsize) n, (*env)->FindClass(env, "java/lang/String"), NULL);
  for (uint32_t i = 0; i < n; i++) {
    uint32_t len = 0;
    const char *name = ts_query_capture_name_for_id(q, i, &len);
    jstring s = jstring_n(env, name, len);
    (*env)->SetObjectArrayElement(env, out, (jsize) i, s);
    (*env)->DeleteLocalRef(env, s);
  }
  return out;
}

jobjectArray FN(queryStringValues)(JNIEnv *env, jclass cls, jlong query) {
  (void) cls;
  const TSQuery *q = (const TSQuery *) (intptr_t) query;
  uint32_t n = ts_query_string_count(q);
  jobjectArray out = (*env)->NewObjectArray(env, (jsize) n, (*env)->FindClass(env, "java/lang/String"), NULL);
  for (uint32_t i = 0; i < n; i++) {
    uint32_t len = 0;
    const char *value = ts_query_string_value_for_id(q, i, &len);
    jstring s = jstring_n(env, value, len);
    (*env)->SetObjectArrayElement(env, out, (jsize) i, s);
    (*env)->DeleteLocalRef(env, s);
  }
  return out;
}

// Pairs of (step type, value id): 0 done, 1 capture, 2 string. Predicates are evaluated in Kotlin.
jintArray FN(queryPredicates)(JNIEnv *env, jclass cls, jlong query, jint pattern) {
  (void) cls;
  uint32_t n = 0;
  const TSQueryPredicateStep *steps = ts_query_predicates_for_pattern((const TSQuery *) (intptr_t) query, (uint32_t) pattern, &n);
  jintArray out = (*env)->NewIntArray(env, (jsize) n * 2);
  if (n) {
    jint *v = malloc(sizeof(jint) * n * 2);
    for (uint32_t i = 0; i < n; i++) {
      v[i * 2] = (jint) steps[i].type;
      v[i * 2 + 1] = (jint) steps[i].value_id;
    }
    (*env)->SetIntArrayRegion(env, out, 0, (jsize) n * 2, v);
    free(v);
  }
  return out;
}

void FN(queryDisablePattern)(JNIEnv *env, jclass cls, jlong query, jint pattern) {
  (void) env; (void) cls;
  ts_query_disable_pattern((TSQuery *) (intptr_t) query, (uint32_t) pattern);
}

/* cursor */

jlong FN(cursorNew)(JNIEnv *env, jclass cls) {
  (void) env; (void) cls;
  Cursor *c = calloc(1, sizeof(Cursor));
  c->cursor = ts_query_cursor_new();
  return (jlong) (intptr_t) c;
}

void FN(cursorDelete)(JNIEnv *env, jclass cls, jlong cursor) {
  (void) env; (void) cls;
  Cursor *c = (Cursor *) (intptr_t) cursor;
  ts_query_cursor_delete(c->cursor);
  free(c);
}

void FN(cursorExec)(JNIEnv *env, jclass cls, jlong cursor, jlong query, jlongArray node) {
  (void) cls;
  Cursor *c = (Cursor *) (intptr_t) cursor;
  ts_query_cursor_exec(c->cursor, (const TSQuery *) (intptr_t) query, node_in(env, node));
}

void FN(cursorSetUnitRange)(JNIEnv *env, jclass cls, jlong cursor, jint start, jint end) {
  (void) env; (void) cls;
  Cursor *c = (Cursor *) (intptr_t) cursor;
  ts_query_cursor_set_byte_range(c->cursor, B(start), B(end));
}

// out: node[4], match id, pattern index, capture index.
jboolean FN(cursorNextCapture)(JNIEnv *env, jclass cls, jlong cursor, jlongArray out) {
  (void) cls;
  Cursor *c = (Cursor *) (intptr_t) cursor;
  uint32_t index = 0;
  if (!ts_query_cursor_next_capture(c->cursor, &c->match, &index)) return JNI_FALSE;
  TSQueryCapture capture = c->match.captures[index];
  jlong v[7];
  v[0] = ((jlong) capture.node.context[0] << 32) | (jlong) capture.node.context[1];
  v[1] = ((jlong) capture.node.context[2] << 32) | (jlong) capture.node.context[3];
  v[2] = (jlong) (intptr_t) capture.node.id;
  v[3] = (jlong) (intptr_t) capture.node.tree;
  v[4] = (jlong) c->match.id;
  v[5] = (jlong) c->match.pattern_index;
  v[6] = (jlong) capture.index;
  (*env)->SetLongArrayRegion(env, out, 0, 7, v);
  return JNI_TRUE;
}

jint FN(cursorMatchCaptureCount)(JNIEnv *env, jclass cls, jlong cursor) {
  (void) env; (void) cls;
  return (jint) ((Cursor *) (intptr_t) cursor)->match.capture_count;
}

// out: node[4], capture index of the i-th capture in the last match.
void FN(cursorMatchCapture)(JNIEnv *env, jclass cls, jlong cursor, jint i, jlongArray out) {
  (void) cls;
  Cursor *c = (Cursor *) (intptr_t) cursor;
  TSQueryCapture capture = c->match.captures[i];
  jlong v[5];
  v[0] = ((jlong) capture.node.context[0] << 32) | (jlong) capture.node.context[1];
  v[1] = ((jlong) capture.node.context[2] << 32) | (jlong) capture.node.context[3];
  v[2] = (jlong) (intptr_t) capture.node.id;
  v[3] = (jlong) (intptr_t) capture.node.tree;
  v[4] = (jlong) capture.index;
  (*env)->SetLongArrayRegion(env, out, 0, 5, v);
}

void FN(cursorRemoveMatch)(JNIEnv *env, jclass cls, jlong cursor, jint match_id) {
  (void) env; (void) cls;
  ts_query_cursor_remove_match(((Cursor *) (intptr_t) cursor)->cursor, (uint32_t) match_id);
}

/* mirror */

jlong FN(mirrorNew)(JNIEnv *env, jclass cls) {
  (void) env; (void) cls;
  return (jlong) (intptr_t) mirror_new();
}

void FN(mirrorDelete)(JNIEnv *env, jclass cls, jlong mirror) {
  (void) env; (void) cls;
  mirror_delete((Mirror *) (intptr_t) mirror);
}

void FN(mirrorReplace)(JNIEnv *env, jclass cls, jlong mirror, jint start, jint end, jstring text) {
  (void) cls;
  const jchar *chars = (*env)->GetStringChars(env, text, NULL);
  jsize len = (*env)->GetStringLength(env, text);
  int ok = mirror_replace((Mirror *) (intptr_t) mirror, (uint32_t) start, (uint32_t) end, (const uint16_t *) chars, (uint32_t) len);
  (*env)->ReleaseStringChars(env, text, chars);
  if (!ok) (*env)->ThrowNew(env, (*env)->FindClass(env, "java/lang/OutOfMemoryError"), "codepad mirror");
}

jint FN(mirrorLength)(JNIEnv *env, jclass cls, jlong mirror) {
  (void) env; (void) cls;
  return (jint) ((Mirror *) (intptr_t) mirror)->length;
}

jstring FN(mirrorText)(JNIEnv *env, jclass cls, jlong mirror, jint start, jint end) {
  (void) cls;
  Mirror *m = (Mirror *) (intptr_t) mirror;
  if (start < 0) start = 0;
  if ((uint32_t) end > m->length) end = (jint) m->length;
  if (start >= end) return (*env)->NewString(env, (const jchar *) "", 0);
  return (*env)->NewString(env, (const jchar *) (m->data + start), end - start);
}

/* language */

jint FN(languageAbiVersion)(JNIEnv *env, jclass cls, jlong language) {
  (void) env; (void) cls;
  return (jint) ts_language_abi_version((const TSLanguage *) (intptr_t) language);
}

jintArray FN(runtimeAbiRange)(JNIEnv *env, jclass cls) {
  (void) cls;
  jint v[2] = { TREE_SITTER_MIN_COMPATIBLE_LANGUAGE_VERSION, TREE_SITTER_LANGUAGE_VERSION };
  jintArray out = (*env)->NewIntArray(env, 2);
  (*env)->SetIntArrayRegion(env, out, 0, 2, v);
  return out;
}
