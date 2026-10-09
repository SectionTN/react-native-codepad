#include <jni.h>
#include <stdint.h>

const void *tree_sitter_typescript(void);

JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_lang_typescript_TypescriptLanguage_nativeLanguage(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_typescript();
}
