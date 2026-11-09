package me.sectiontn.codepad.lang.kv_lite

import me.sectiontn.codepad.syntax.LanguageProvider

class KvLiteLanguage : LanguageProvider {
  override val id: String = "kv_lite"
  override val languagePointer: Long get() = nativeLanguage()
  override val highlights: String = HIGHLIGHTS
  override val injections: String = INJECTIONS

  private external fun nativeLanguage(): Long

  companion object {
    init {
      System.loadLibrary("codepad_lang_kv_lite")
    }

    private val HIGHLIGHTS: String = """(key) @property

"=" @operator

(string) @string

(number) @number

(boolean) @boolean

(comment) @comment
"""
    private val INJECTIONS: String = """"""
  }
}
