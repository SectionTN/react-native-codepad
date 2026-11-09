#include <jni.h>
#include <stdint.h>

const void *tree_sitter_kv_lite(void);

JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_lang_kv_1lite_KvLiteLanguage_nativeLanguage(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_kv_lite();
}
