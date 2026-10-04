#include <jni.h>
#include <stdint.h>

const void *tree_sitter_javascript(void);

JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_lang_javascript_JavascriptLanguage_nativeLanguage(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_javascript();
}
