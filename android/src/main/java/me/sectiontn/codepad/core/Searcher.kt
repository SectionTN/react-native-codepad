package me.sectiontn.codepad.core

import java.util.concurrent.CancellationException
import java.util.regex.Pattern
import java.util.regex.PatternSyntaxException

data class SearchQuery(
  val text: String,
  val regex: Boolean = false,
  val caseSensitive: Boolean = false,
  val wholeWord: Boolean = false,
)

object Searcher {
  val NEVER: () -> Boolean = { false }

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

  /**
   * Packed start and end pairs of the non overlapping matches in document order. Empty matches are skipped.
   * Only the plain find() advances the scan: Android's ICU matcher copies the whole text again on find(from).
   */
  fun find(text: CharSequence, q: SearchQuery, cancel: () -> Boolean = NEVER): IntArray {
    if (q.text.isEmpty()) return IntArray(0)
    val subject = if (cancel === NEVER) text else CancellableText(text, cancel)
    val m = compile(q).matcher(subject)
    var out = IntArray(64)
    var n = 0
    while (!cancel() && m.find()) {
      val s = m.start()
      val e = m.end()
      if (e == s) continue
      if (!q.wholeWord || isWordBounded(subject, s, e)) {
        if (n == out.size) out = out.copyOf(n * 2)
        out[n++] = s
        out[n++] = e
      }
    }
    if (cancel()) throw CancellationException()
    return out.copyOf(n)
  }

  private fun isWordBounded(text: CharSequence, s: Int, e: Int): Boolean {
    val before = s == 0 || !TextMovement.isWordChar(text[s - 1])
    val after = e >= text.length || !TextMovement.isWordChar(text[e])
    return before && after
  }
}

/** Throws CancellationException from the next read once [cancel] answers true, so a regex scan stops inside the engine. */
class CancellableText(private val text: CharSequence, private val cancel: () -> Boolean) : CharSequence {
  override val length: Int get() = text.length

  override fun get(index: Int): Char {
    if (cancel()) throw CancellationException()
    return text[index]
  }

  override fun subSequence(startIndex: Int, endIndex: Int): CharSequence =
    CancellableText(text.subSequence(startIndex, endIndex), cancel)

  override fun toString(): String = text.toString()
}
