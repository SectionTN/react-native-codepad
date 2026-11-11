package me.sectiontn.codepad.lang.ini

import me.sectiontn.codepad.syntax.LanguageProvider

class IniLanguage : LanguageProvider {
  override val id: String = "ini"
  override val languagePointer: Long get() = nativeLanguage()
  override val highlights: String = HIGHLIGHTS
  override val injections: String = INJECTIONS

  private external fun nativeLanguage(): Long

  companion object {
    init {
      System.loadLibrary("codepad_lang_ini")
    }

    private val HIGHLIGHTS: String = """(section_name
  (text) @markup.heading)

(comment) @comment @spell

[
  "["
  "]"
] @punctuation.bracket

"=" @operator

(setting
  (setting_name) @property)

(setting_value) @string
"""
    private val INJECTIONS: String = """((comment
  (text) @injection.content)
  (#set! injection.language "comment"))
"""
  }
}
