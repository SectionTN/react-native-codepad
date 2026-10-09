package me.sectiontn.codepad.lang.json

import me.sectiontn.codepad.syntax.LanguageProvider

class JsonLanguage : LanguageProvider {
  override val id: String = "json"
  override val languagePointer: Long get() = nativeLanguage()
  override val highlights: String = HIGHLIGHTS
  override val injections: String = INJECTIONS

  private external fun nativeLanguage(): Long

  companion object {
    init {
      System.loadLibrary("codepad_lang_json")
    }

    private val HIGHLIGHTS: String = """[
  (true)
  (false)
] @boolean

(null) @constant.builtin

(number) @number

(pair
  key: (string) @property)

(pair
  value: (string) @string)

(array
  (string) @string)

[
  ","
  ":"
] @punctuation.delimiter

[
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

("\"" @conceal
  (#set! conceal ""))

(escape_sequence) @string.escape

((escape_sequence) @conceal
  (#eq? @conceal "\\\"")
  (#set! conceal "\""))

(comment) @comment @spell
"""
    private val INJECTIONS: String = """((comment) @injection.content
  (#set! injection.language "comment"))
"""
  }
}
