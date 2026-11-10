#include <jni.h>
#include <stdint.h>

const void *tree_sitter_php(void);
const void *tree_sitter_php_only(void);

JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_lang_php_PhpLanguage_nativeLanguage(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_php();
}

JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_lang_php_1only_PhpOnlyLanguage_nativeLanguage(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_php_only();
}
