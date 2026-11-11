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

// A callback must not leave an exception pending in core code. ExceptionDescribe logs it and clears it.
void clear(JNIEnv *e) {
  if (e->ExceptionCheck()) e->ExceptionDescribe();
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
