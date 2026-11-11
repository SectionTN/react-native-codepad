#include <jni.h>
#include <stdint.h>

const void *tree_sitter_ini(void);

JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_lang_ini_IniLanguage_nativeLanguage(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_ini();
}
