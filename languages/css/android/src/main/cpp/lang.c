#include <jni.h>
#include <stdint.h>

const void *tree_sitter_css(void);

JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_lang_css_CssLanguage_nativeLanguage(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_css();
}
