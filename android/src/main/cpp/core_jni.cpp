// The Android binding of the core's C API. Offsets cross as UTF-16 units, as everywhere.
#include <jni.h>
#include <time.h>

#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

#include "codepad.h"

#define FN(name) extern "C" JNIEXPORT auto JNICALL Java_me_sectiontn_codepad_syntax_CoreNative_##name

namespace {

JavaVM *vm = nullptr;
// Cached on the first engine, from a thread that sees the app's classes: workers cannot look them up.
jclass host_class = nullptr;
jmethodID schedule_id = nullptr;
jmethodID post_id = nullptr;
jmethodID snapshot_id = nullptr;
jmethodID resolve_id = nullptr;

JNIEnv *env() {
  JNIEnv *e = nullptr;
  if (vm->GetEnv(reinterpret_cast<void **>(&e), JNI_VERSION_1_6) == JNI_OK) return e;
  // The NDK takes JNIEnv ** where the JDK takes void **.
#ifdef __ANDROID__
  vm->AttachCurrentThread(&e, nullptr);
#else
  vm->AttachCurrentThread(reinterpret_cast<void **>(&e), nullptr);
#endif
  return e;
}

// A callback must not leave an exception pending in core code. ART's ExceptionDescribe logs it but keeps it pending.
void clear(JNIEnv *e) {
  if (!e->ExceptionCheck()) return;
  e->ExceptionDescribe();
  e->ExceptionClear();
}

// The core's strings are UTF-8. NewStringUTF reads modified UTF-8, and CheckJNI aborts on a 4-byte sequence.
jstring java_string(JNIEnv *e, const char *s) {
  std::u16string out;
  for (auto *p = reinterpret_cast<const unsigned char *>(s); *p;) {
    uint32_t c = *p++;
    int extra = c >= 0xF0 ? 3 : c >= 0xE0 ? 2 : c >= 0xC0 ? 1 : 0;
    c &= extra ? 0x3F >> extra : 0x7F;
    for (; extra > 0 && (*p & 0xC0) == 0x80; extra--) c = (c << 6) | (*p++ & 0x3F);
    if (c >= 0x10000) {
      out.push_back(static_cast<char16_t>(0xD800 + ((c - 0x10000) >> 10)));
      out.push_back(static_cast<char16_t>(0xDC00 + ((c - 0x10000) & 0x3FF)));
    } else {
      out.push_back(static_cast<char16_t>(c));
    }
  }
  return e->NewString(reinterpret_cast<const jchar *>(out.data()), static_cast<jsize>(out.size()));
}

struct HostRef {
  jobject host;
};

void schedule(void *ctx, void (*work)(void *), void *arg) {
  JNIEnv *e = env();
  e->CallVoidMethod(static_cast<HostRef *>(ctx)->host, schedule_id, static_cast<jlong>(reinterpret_cast<intptr_t>(work)),
                    static_cast<jlong>(reinterpret_cast<intptr_t>(arg)));
  clear(e);
}

void post_main(void *ctx, void (*work)(void *), void *arg) {
  JNIEnv *e = env();
  e->CallVoidMethod(static_cast<HostRef *>(ctx)->host, post_id, static_cast<jlong>(reinterpret_cast<intptr_t>(work)),
                    static_cast<jlong>(reinterpret_cast<intptr_t>(arg)));
  clear(e);
}

int64_t now_micros(void *) {
  timespec ts{};
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return static_cast<int64_t>(ts.tv_sec) * 1000000 + ts.tv_nsec / 1000;
}

const cp_language *resolve(void *ctx, const char *id) {
  JNIEnv *e = env();
  jstring name = java_string(e, id);
  jlong handle = e->CallLongMethod(static_cast<HostRef *>(ctx)->host, resolve_id, name);
  e->DeleteLocalRef(name);
  if (e->ExceptionCheck()) {
    clear(e);
    return nullptr;
  }
  return reinterpret_cast<const cp_language *>(static_cast<intptr_t>(handle));
}

void on_snapshot(void *ctx, cp_snapshot *snapshot) {
  JNIEnv *e = env();
  auto *ref = static_cast<HostRef *>(ctx);
  e->CallVoidMethod(ref->host, snapshot_id, static_cast<jlong>(reinterpret_cast<intptr_t>(snapshot)));
  clear(e);
  // The final post after close: the host reference may go.
  if (!snapshot) {
    e->DeleteGlobalRef(ref->host);
    delete ref;
  }
}

std::u16string units(JNIEnv *e, jstring s) {
  jsize n = e->GetStringLength(s);
  std::u16string out(static_cast<size_t>(n), u'\0');
  e->GetStringRegion(s, 0, n, reinterpret_cast<jchar *>(out.data()));
  return out;
}

template <typename T>
T *ptr(jlong v) {
  return reinterpret_cast<T *>(static_cast<intptr_t>(v));
}

jlong handle(const void *p) { return static_cast<jlong>(reinterpret_cast<intptr_t>(p)); }

// Runs a core call that fills an int buffer straight into the Java array.
template <typename Call>
jint fill(JNIEnv *e, jintArray out, Call call) {
  jsize cap = out ? e->GetArrayLength(out) : 0;
  jint *buffer = out ? static_cast<jint *>(e->GetPrimitiveArrayCritical(out, nullptr)) : nullptr;
  uint32_t needed = call(reinterpret_cast<int32_t *>(buffer), static_cast<uint32_t>(cap));
  if (buffer) e->ReleasePrimitiveArrayCritical(out, buffer, 0);
  return static_cast<jint>(needed);
}

}  // namespace

FN(abiRange)(JNIEnv *e, jclass) -> jintArray {
  jintArray out = e->NewIntArray(2);
  jint v[2] = {cp_abi_min(), cp_abi_max()};
  e->SetIntArrayRegion(out, 0, 2, v);
  return out;
}

// error[0] receives the message: set on failure, and on success when only the injections failed.
FN(languageLoad)(JNIEnv *e, jclass, jstring jid, jlong pointer, jbyteArray highlights, jbyteArray injections,
                 jobjectArray error) -> jlong {
  const char *id = e->GetStringUTFChars(jid, nullptr);
  jsize hn = e->GetArrayLength(highlights);
  jsize in = injections ? e->GetArrayLength(injections) : 0;
  std::vector<char> h(static_cast<size_t>(hn));
  std::vector<char> i(static_cast<size_t>(in));
  e->GetByteArrayRegion(highlights, 0, hn, reinterpret_cast<jbyte *>(h.data()));
  if (in > 0) e->GetByteArrayRegion(injections, 0, in, reinterpret_cast<jbyte *>(i.data()));
  char message[512] = {0};
  cp_language *language = cp_language_load(id, ptr<const void>(pointer), h.data(), static_cast<uint32_t>(hn), i.data(),
                                           static_cast<uint32_t>(in), message, sizeof(message));
  e->ReleaseStringUTFChars(jid, id);
  if (message[0] && error) e->SetObjectArrayElement(error, 0, java_string(e, message));
  return handle(language);
}

FN(styleId)(JNIEnv *e, jclass, jstring jname) -> jint {
  const char *name = e->GetStringUTFChars(jname, nullptr);
  jint id = cp_style_id(name);
  e->ReleaseStringUTFChars(jname, name);
  return id;
}

FN(styleName)(JNIEnv *e, jclass, jint id) -> jstring {
  uint32_t length = cp_style_name(id, nullptr, 0);
  std::string name(length + 1, '\0');
  cp_style_name(id, name.data(), length + 1);
  name.resize(length);
  return java_string(e, name.c_str());
}

FN(engineNew)(JNIEnv *e, jclass, jobject host, jlong budget) -> jlong {
  if (!vm) e->GetJavaVM(&vm);
  if (!host_class) {
    host_class = static_cast<jclass>(e->NewGlobalRef(e->GetObjectClass(host)));
    schedule_id = e->GetMethodID(host_class, "schedule", "(JJ)V");
    post_id = e->GetMethodID(host_class, "postMain", "(JJ)V");
    snapshot_id = e->GetMethodID(host_class, "snapshot", "(J)V");
    resolve_id = e->GetMethodID(host_class, "resolve", "(Ljava/lang/String;)J");
  }
  auto *ref = new HostRef{e->NewGlobalRef(host)};
  cp_host h{};
  h.ctx = ref;
  h.schedule = schedule;
  h.post_main = post_main;
  h.now_micros = now_micros;
  h.resolve = resolve;
  return handle(cp_engine_new(&h, budget, on_snapshot));
}

FN(run)(JNIEnv *, jclass, jlong work, jlong arg) -> void {
  ptr<void(void *)>(work)(ptr<void>(arg));
}

FN(engineSetLanguage)(JNIEnv *, jclass, jlong engine, jlong language) -> void {
  cp_engine_set_language(ptr<cp_engine>(engine), ptr<const cp_language>(language));
}

FN(engineSetText)(JNIEnv *e, jclass, jlong engine, jstring text, jint revision) -> void {
  std::u16string t = units(e, text);
  cp_engine_set_text(ptr<cp_engine>(engine), reinterpret_cast<const cp_unit *>(t.data()), static_cast<uint32_t>(t.size()),
                     revision);
}

// points: start line, start column, old end line, old end column, new end line, new end column.
FN(engineEdit)(JNIEnv *e, jclass, jlong engine, jint start, jint removed, jstring inserted, jint revision,
               jintArray points) -> void {
  std::u16string t = units(e, inserted);
  jint p[6];
  e->GetIntArrayRegion(points, 0, 6, p);
  cp_engine_edit(ptr<cp_engine>(engine), static_cast<uint32_t>(start), static_cast<uint32_t>(removed),
                 reinterpret_cast<const cp_unit *>(t.data()), static_cast<uint32_t>(t.size()), revision,
                 cp_point{p[0], p[1]}, cp_point{p[2], p[3]}, cp_point{p[4], p[5]});
}

FN(engineRelease)(JNIEnv *, jclass, jlong engine, jlong snapshot) -> void {
  cp_engine_release(ptr<cp_engine>(engine), ptr<cp_snapshot>(snapshot));
}

FN(engineClose)(JNIEnv *, jclass, jlong engine) -> void { cp_engine_close(ptr<cp_engine>(engine)); }

// out: revision, based_on, latency_ms, fresh, reused, carried, changed_len, length.
FN(snapshotInfo)(JNIEnv *e, jclass, jlong snapshot, jintArray out) -> void {
  cp_snapshot_info info{};
  cp_snapshot_info_get(ptr<cp_snapshot>(snapshot), &info);
  jint v[8] = {info.revision, info.based_on, info.latency_ms, info.fresh, info.reused, info.carried,
               static_cast<jint>(info.changed_len), static_cast<jint>(cp_snapshot_length(ptr<cp_snapshot>(snapshot)))};
  e->SetIntArrayRegion(out, 0, 8, v);
}

FN(snapshotChanged)(JNIEnv *e, jclass, jlong snapshot) -> jintArray {
  cp_snapshot_info info{};
  cp_snapshot_info_get(ptr<cp_snapshot>(snapshot), &info);
  jintArray out = e->NewIntArray(static_cast<jsize>(info.changed_len));
  if (info.changed_len) {
    e->SetIntArrayRegion(out, 0, static_cast<jsize>(info.changed_len),
                         reinterpret_cast<const jint *>(cp_snapshot_changed(ptr<cp_snapshot>(snapshot))));
  }
  return out;
}

FN(snapshotLanguage)(JNIEnv *, jclass, jlong snapshot) -> jlong {
  return handle(cp_snapshot_language(ptr<cp_snapshot>(snapshot)));
}

FN(languageId)(JNIEnv *e, jclass, jlong language) -> jstring {
  return java_string(e, cp_language_id(ptr<cp_language>(language)));
}

FN(injectedCount)(JNIEnv *, jclass, jlong snapshot) -> jint {
  return static_cast<jint>(cp_snapshot_injected_count(ptr<cp_snapshot>(snapshot)));
}

// out: start, end, shift, ranges. Returns the language handle.
FN(injectedGet)(JNIEnv *e, jclass, jlong snapshot, jint index, jintArray out) -> jlong {
  cp_injected_info info{};
  cp_snapshot_injected_get(ptr<cp_snapshot>(snapshot), static_cast<uint32_t>(index), &info);
  jint v[4] = {info.start, info.end, info.shift, static_cast<jint>(info.ranges)};
  e->SetIntArrayRegion(out, 0, 4, v);
  return handle(info.language);
}

FN(highlight)(JNIEnv *e, jclass, jlong snapshot, jint first, jint last, jint start, jintArray out) -> jint {
  return fill(e, out, [&](int32_t *b, uint32_t cap) {
    return cp_highlight(ptr<cp_snapshot>(snapshot), first, last, static_cast<uint32_t>(start), b, cap);
  });
}

FN(frame)(JNIEnv *e, jclass, jlong snapshot, jint first, jint last, jint start, jint applied, jboolean use_changed,
          jintArray entries, jintArray out) -> jint {
  jsize n = e->GetArrayLength(entries);
  std::vector<int32_t> revisions(static_cast<size_t>(n));
  e->GetIntArrayRegion(entries, 0, n, reinterpret_cast<jint *>(revisions.data()));
  return fill(e, out, [&](int32_t *b, uint32_t cap) {
    return cp_frame(ptr<cp_snapshot>(snapshot), first, last, static_cast<uint32_t>(start), applied, use_changed ? 1 : 0,
                    revisions.data(), b, cap);
  });
}

FN(shiftSpans)(JNIEnv *e, jclass, jintArray spans, jint start, jint removed, jint inserted, jintArray out) -> jint {
  jsize n = e->GetArrayLength(spans);
  std::vector<int32_t> in(static_cast<size_t>(n));
  e->GetIntArrayRegion(spans, 0, n, reinterpret_cast<jint *>(in.data()));
  return fill(e, out, [&](int32_t *b, uint32_t cap) {
    return cp_shift_spans(in.data(), static_cast<uint32_t>(n), start, removed, inserted, b, cap);
  });
}

// The editor. Its callbacks run on the calling thread inside the core call, after the lock is released. The Kotlin
// host catches what they throw and rethrows once the call returns, so no exception is pending in core code.
namespace {

jmethodID changed_id = nullptr;
jmethodID selected_id = nullptr;
jmethodID now_id = nullptr;

struct EditorRef {
  jobject host;
};

// A pending exception (an allocation failure, a throwing test clock) is left for the external call to throw: the
// trampolines then return at once and make no other JNI call.
void editor_changed(void *ctx, const cp_change *c, const cp_unit *removed, const cp_unit *inserted, int32_t origin) {
  JNIEnv *e = env();
  if (e->ExceptionCheck()) return;
  jstring r = e->NewString(reinterpret_cast<const jchar *>(removed), c->removed_len);
  jstring i = r != nullptr ? e->NewString(reinterpret_cast<const jchar *>(inserted), c->inserted_len) : nullptr;
  if (i != nullptr) e->CallVoidMethod(static_cast<EditorRef *>(ctx)->host, changed_id, c->start, r, i, c->revision, origin);
  if (r != nullptr) e->DeleteLocalRef(r);
  if (i != nullptr) e->DeleteLocalRef(i);
}

void editor_selected(void *ctx, int32_t anchor, int32_t head) {
  JNIEnv *e = env();
  if (!e->ExceptionCheck()) e->CallVoidMethod(static_cast<EditorRef *>(ctx)->host, selected_id, anchor, head);
}

int64_t editor_now(void *ctx) {
  JNIEnv *e = env();
  return e->ExceptionCheck() ? 0 : e->CallLongMethod(static_cast<EditorRef *>(ctx)->host, now_id);
}

cp_editor *ed(jlong v) { return ptr<cp_editor>(v); }

std::u16string chars(JNIEnv *e, jstring s) { return s ? units(e, s) : std::u16string(); }

const cp_unit *units_of(const std::u16string &s) { return reinterpret_cast<const cp_unit *>(s.data()); }

uint32_t count_of(const std::u16string &s) { return static_cast<uint32_t>(s.size()); }

uint32_t at(jint v) { return static_cast<uint32_t>(v < 0 ? 0 : v); }

jstring copy_text(JNIEnv *e, const cp_editor *editor, uint32_t start, uint32_t end) {
  uint32_t n = cp_doc_copy(editor, start, end, nullptr, 0);
  std::u16string out(n, u'\0');
  if (n > 0) cp_doc_copy(editor, start, end, reinterpret_cast<cp_unit *>(out.data()), n);
  return e->NewString(reinterpret_cast<const jchar *>(out.data()), static_cast<jsize>(n));
}

jintArray int_array(JNIEnv *e, const int32_t *values, uint32_t n) {
  jintArray out = e->NewIntArray(static_cast<jsize>(n));
  if (n > 0) e->SetIntArrayRegion(out, 0, static_cast<jsize>(n), reinterpret_cast<const jint *>(values));
  return out;
}

}  // namespace

FN(editorNew)(JNIEnv *e, jclass, jobject host, jstring text, jboolean clock, jlongArray ref_out) -> jlong {
  if (vm == nullptr) e->GetJavaVM(&vm);
  if (changed_id == nullptr) {
    jclass cls = e->GetObjectClass(host);
    changed_id = e->GetMethodID(cls, "changed", "(ILjava/lang/String;Ljava/lang/String;II)V");
    selected_id = e->GetMethodID(cls, "selected", "(II)V");
    now_id = e->GetMethodID(cls, "now", "()J");
    e->DeleteLocalRef(cls);
  }
  auto *ref = new EditorRef{e->NewGlobalRef(host)};
  cp_editor_host h{};
  h.ctx = ref;
  h.now_millis = clock ? editor_now : nullptr;
  h.on_change = editor_changed;
  h.on_selection = editor_selected;
  std::u16string s = chars(e, text);
  jlong refs[1] = {handle(ref)};
  e->SetLongArrayRegion(ref_out, 0, 1, refs);
  return handle(cp_editor_new(&h, units_of(s), count_of(s)));
}

FN(editorFree)(JNIEnv *e, jclass, jlong editor, jlong ref) -> void {
  cp_editor_free(ed(editor));
  auto *r = ptr<EditorRef>(ref);
  e->DeleteGlobalRef(r->host);
  delete r;
}

FN(lockShared)(JNIEnv *, jclass, jlong editor) -> void { cp_editor_lock_shared(ed(editor)); }
FN(unlockShared)(JNIEnv *, jclass, jlong editor) -> void { cp_editor_unlock_shared(ed(editor)); }
FN(docLength)(JNIEnv *, jclass, jlong editor) -> jint { return static_cast<jint>(cp_doc_length(ed(editor))); }
FN(docRevision)(JNIEnv *, jclass, jlong editor) -> jint { return cp_doc_revision(ed(editor)); }
FN(docLineCount)(JNIEnv *, jclass, jlong editor) -> jint { return cp_doc_line_count(ed(editor)); }

FN(docLineStart)(JNIEnv *, jclass, jlong editor, jint line) -> jint {
  return static_cast<jint>(cp_doc_line_start(ed(editor), line));
}

FN(docLineEnd)(JNIEnv *, jclass, jlong editor, jint line) -> jint {
  return static_cast<jint>(cp_doc_line_end(ed(editor), line));
}

FN(docLineAt)(JNIEnv *, jclass, jlong editor, jint offset) -> jint { return cp_doc_line_at(ed(editor), at(offset)); }

FN(docUnitAt)(JNIEnv *, jclass, jlong editor, jint offset) -> jchar {
  return static_cast<jchar>(cp_doc_unit_at(ed(editor), at(offset)));
}

FN(docText)(JNIEnv *e, jclass, jlong editor, jint start, jint end) -> jstring {
  return copy_text(e, ed(editor), at(start), at(end));
}

FN(docPosition)(JNIEnv *, jclass, jlong editor, jint offset) -> jlong {
  cp_point p = cp_doc_position(ed(editor), at(offset));
  return (static_cast<jlong>(p.line) << 32) | static_cast<uint32_t>(p.column);
}

FN(docOffset)(JNIEnv *, jclass, jlong editor, jint line, jint column) -> jint {
  return static_cast<jint>(cp_doc_offset(ed(editor), line, column));
}

FN(docGrapheme)(JNIEnv *, jclass, jlong editor, jint offset, jboolean forward) -> jint {
  return static_cast<jint>(cp_doc_grapheme(ed(editor), at(offset), forward ? 1 : 0));
}

FN(editorSettings)(JNIEnv *, jclass, jlong editor, jint tab, jboolean spaces, jboolean indent, jboolean close)
    -> void {
  cp_settings s{tab, spaces ? 1 : 0, indent ? 1 : 0, close ? 1 : 0};
  cp_editor_set_settings(ed(editor), &s);
}

FN(editorReplace)(JNIEnv *e, jclass, jlong editor, jint start, jint end, jstring text, jint origin, jboolean typing,
                  jboolean caret_after) -> void {
  std::u16string s = chars(e, text);
  cp_editor_replace(ed(editor), at(start), at(end), units_of(s), count_of(s), origin, typing ? 1 : 0, caret_after ? 1 : 0);
}

FN(editorSetText)(JNIEnv *e, jclass, jlong editor, jstring text, jboolean keep_history) -> void {
  std::u16string s = chars(e, text);
  cp_editor_set_text(ed(editor), units_of(s), count_of(s), keep_history ? 1 : 0);
}

FN(editorInsert)(JNIEnv *e, jclass, jlong editor, jstring text, jint origin) -> void {
  std::u16string s = chars(e, text);
  cp_editor_insert(ed(editor), units_of(s), count_of(s), origin);
}

FN(editorType)(JNIEnv *e, jclass, jlong editor, jstring text) -> void {
  std::u16string s = chars(e, text);
  cp_editor_type(ed(editor), units_of(s), count_of(s));
}

FN(editorCommand)(JNIEnv *, jclass, jlong editor, jint command) -> jboolean {
  return cp_editor_command(ed(editor), command) != 0;
}

FN(editorSetSelection)(JNIEnv *, jclass, jlong editor, jint anchor, jint head) -> void {
  cp_editor_set_selection(ed(editor), anchor, head);
}

FN(editorMove)(JNIEnv *, jclass, jlong editor, jint unit, jboolean forward, jboolean extend) -> void {
  cp_editor_move(ed(editor), unit, forward ? 1 : 0, extend ? 1 : 0);
}

FN(editorSelectWordAt)(JNIEnv *, jclass, jlong editor, jint offset) -> void {
  cp_editor_select_word_at(ed(editor), at(offset));
}

FN(editorDeletesPair)(JNIEnv *, jclass, jlong editor, jint caret) -> jboolean {
  return cp_editor_deletes_pair(ed(editor), at(caret)) != 0;
}

FN(editorBeginGroup)(JNIEnv *, jclass, jlong editor) -> void { cp_editor_begin_group(ed(editor)); }
FN(editorEndGroup)(JNIEnv *, jclass, jlong editor) -> void { cp_editor_end_group(ed(editor)); }

FN(editorSelectionDirty)(JNIEnv *, jclass, jlong editor) -> jboolean {
  return cp_editor_selection_dirty(ed(editor)) != 0;
}

FN(editorSetSelectionDirty)(JNIEnv *, jclass, jlong editor, jboolean dirty) -> void {
  cp_editor_set_selection_dirty(ed(editor), dirty ? 1 : 0);
}

FN(editorSelection)(JNIEnv *, jclass, jlong editor) -> jlong { return cp_editor_selection(ed(editor)); }
FN(editorHistory)(JNIEnv *, jclass, jlong editor) -> jint { return cp_editor_history(ed(editor)); }

FN(editorBracketMatch)(JNIEnv *e, jclass, jlong editor, jlong snapshot, jint caret, jintArray out) -> jboolean {
  int32_t pair[2] = {0, 0};
  if (cp_editor_bracket_match(ed(editor), ptr<cp_snapshot>(snapshot), at(caret), pair) == 0) return JNI_FALSE;
  e->SetIntArrayRegion(out, 0, 2, reinterpret_cast<const jint *>(pair));
  return JNI_TRUE;
}

// items: kind, a, b, payload per decoration.
FN(editorSetDecorations)(JNIEnv *e, jclass, jlong editor, jintArray items, jint revision) -> jboolean {
  jsize n = e->GetArrayLength(items);
  std::vector<cp_decoration> list(static_cast<size_t>(n / 4));
  if (!list.empty()) e->GetIntArrayRegion(items, 0, n / 4 * 4, reinterpret_cast<jint *>(list.data()));
  return cp_editor_set_decorations(ed(editor), list.data(), static_cast<uint32_t>(list.size()), revision) != 0;
}

FN(editorDecorations)(JNIEnv *e, jclass, jlong editor) -> jintArray {
  uint32_t n = cp_editor_decorations(ed(editor), nullptr, 0);
  std::vector<cp_decoration> list(n);
  if (n > 0) cp_editor_decorations(ed(editor), list.data(), n);
  return int_array(e, reinterpret_cast<const int32_t *>(list.data()), n * 4);
}

FN(editorDecorationsVersion)(JNIEnv *, jclass, jlong editor) -> jint {
  return cp_editor_decorations_version(ed(editor));
}

FN(editorAttach)(JNIEnv *, jclass, jlong editor, jlong engine) -> void {
  cp_editor_attach(ed(editor), ptr<cp_engine>(engine));
}

FN(editorSetSearch)(JNIEnv *e, jclass, jlong editor, jstring query, jint flags, jobjectArray error) -> jboolean {
  std::u16string q = chars(e, query);
  char message[512] = {0};
  if (cp_editor_set_search(ed(editor), units_of(q), count_of(q), flags, message, sizeof(message)) != 0) return JNI_TRUE;
  jstring m = java_string(e, message);
  e->SetObjectArrayElement(error, 0, m);
  e->DeleteLocalRef(m);
  return JNI_FALSE;
}

FN(editorClearSearch)(JNIEnv *, jclass, jlong editor) -> void { cp_editor_clear_search(ed(editor)); }

FN(editorSearchActive)(JNIEnv *, jclass, jlong editor) -> jboolean {
  return cp_editor_search_active(ed(editor)) != 0;
}

FN(editorSearchStale)(JNIEnv *, jclass, jlong editor) -> jboolean { return cp_editor_search_stale(ed(editor)) != 0; }
FN(editorMatchCount)(JNIEnv *, jclass, jlong editor) -> jint { return cp_editor_match_count(ed(editor)); }

FN(editorMatches)(JNIEnv *e, jclass, jlong editor) -> jintArray {
  uint32_t n = cp_editor_matches(ed(editor), nullptr, 0);
  std::vector<int32_t> out(n);
  if (n > 0) cp_editor_matches(ed(editor), out.data(), n);
  return int_array(e, out.data(), n);
}

FN(editorFind)(JNIEnv *e, jclass, jlong editor, jboolean forward, jintArray out) -> jboolean {
  int32_t hit[2] = {0, 0};
  if (cp_editor_find(ed(editor), forward ? 1 : 0, &hit[0], &hit[1]) == 0) return JNI_FALSE;
  e->SetIntArrayRegion(out, 0, 2, reinterpret_cast<const jint *>(hit));
  return JNI_TRUE;
}

FN(editorReplaceCurrent)(JNIEnv *e, jclass, jlong editor, jstring text) -> jboolean {
  std::u16string s = chars(e, text);
  return cp_editor_replace_current(ed(editor), units_of(s), count_of(s)) != 0;
}

FN(editorReplaceAll)(JNIEnv *e, jclass, jlong editor, jstring text) -> jint {
  std::u16string s = chars(e, text);
  return cp_editor_replace_all(ed(editor), units_of(s), count_of(s));
}

FN(editorAcceptMatches)(JNIEnv *e, jclass, jlong editor, jint revision, jintArray pairs) -> jboolean {
  jsize n = e->GetArrayLength(pairs);
  std::vector<int32_t> in(static_cast<size_t>(n));
  if (n > 0) e->GetIntArrayRegion(pairs, 0, n, reinterpret_cast<jint *>(in.data()));
  return cp_editor_accept_matches(ed(editor), revision, in.data(), static_cast<uint32_t>(n)) != 0;
}

FN(editorSearchQuery)(JNIEnv *, jclass, jlong editor) -> jlong { return handle(cp_editor_search_query(ed(editor))); }
FN(searchRelease)(JNIEnv *, jclass, jlong search) -> void { cp_search_release(ptr<cp_search>(search)); }
FN(editorText)(JNIEnv *, jclass, jlong editor) -> jlong { return handle(cp_editor_text(ed(editor))); }
FN(textRelease)(JNIEnv *, jclass, jlong text) -> void { cp_text_release(ptr<cp_text>(text)); }

// A worker call: no Kotlin runs inside, so the output array can stay critical. -1 means the match limit was hit.
FN(searchFind)(JNIEnv *e, jclass, jlong search, jlong text, jint from, jintArray out) -> jint {
  jsize cap = e->GetArrayLength(out);
  auto *buffer = static_cast<jint *>(e->GetPrimitiveArrayCritical(out, nullptr));
  int32_t n = cp_search_find(ptr<cp_search>(search), ptr<cp_text>(text), at(from), reinterpret_cast<int32_t *>(buffer),
                             static_cast<uint32_t>(cap));
  e->ReleasePrimitiveArrayCritical(out, buffer, 0);
  return n;
}
