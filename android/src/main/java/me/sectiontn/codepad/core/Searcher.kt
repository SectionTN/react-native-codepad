package me.sectiontn.codepad.core

import java.util.regex.Pattern
import java.util.regex.PatternSyntaxException

data class SearchQuery(
  val text: String,
  val regex: Boolean = false,
  val caseSensitive: Boolean = false,
  val wholeWord: Boolean = false,
)

object Searcher {
  /** Throws IllegalArgumentException carrying the engine's message when the regex is invalid. */
  fun compile(q: SearchQuery): Pattern {
    var flags = Pattern.MULTILINE
    if (!q.caseSensitive) flags = flags or Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE
    val body = if (q.regex) q.text else Pattern.quote(q.text)
    return try {
      Pattern.compile(body, flags)
    } catch (e: PatternSyntaxException) {
      throw IllegalArgumentException(e.description ?: e.message ?: "invalid regex")
    }
  }

  /** Non overlapping matches in document order. Empty matches are skipped. */
  fun find(text: CharSequence, q: SearchQuery): List<Range> {
    if (q.text.isEmpty()) return emptyList()
    val m = compile(q).matcher(text)
    val out = ArrayList<Range>()
    var from = 0
    while (from <= text.length && m.find(from)) {
      val s = m.start()
      val e = m.end()
      if (e == s) {
        from = s + 1
        continue
      }
      if (!q.wholeWord || isWordBounded(text, s, e)) out.add(Range(s, e))
      from = e
    }
    return out
  }

  private fun isWordBounded(text: CharSequence, s: Int, e: Int): Boolean {
    val before = s == 0 || !TextMovement.isWordChar(text[s - 1])
    val after = e >= text.length || !TextMovement.isWordChar(text[e])
    return before && after
  }
}
