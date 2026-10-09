#include <jni.h>
#include <stdint.h>

const void *tree_sitter_markdown(void);
const void *tree_sitter_markdown_inline(void);

JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_lang_markdown_MarkdownLanguage_nativeLanguage(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_markdown();
}

JNIEXPORT jlong JNICALL Java_me_sectiontn_codepad_lang_markdown_1inline_MarkdownInlineLanguage_nativeLanguage(JNIEnv *env, jobject thiz) {
  (void) env;
  (void) thiz;
  return (jlong) (intptr_t) tree_sitter_markdown_inline();
}
