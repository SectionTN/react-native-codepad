#include <jni.h>
#include <stdint.h>

const void *tree_sitter_xml(void);
const void *tree_sitter_dtd(void);

JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_lang_xml_XmlLanguage_nativeLanguage(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_xml();
}

JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_lang_dtd_DtdLanguage_nativeLanguage(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_dtd();
}
