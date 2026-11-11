package me.sectiontn.codepad.core

import java.util.concurrent.CancellationException
import me.sectiontn.codepad.syntax.CoreNative

data class SearchQuery(
  val text: String,
  val regex: Boolean = false,
  val caseSensitive: Boolean = false,
  val wholeWord: Boolean = false,
)

/** Runs a query the core compiled over a text snapshot, on any thread. */
object Searcher {
  const val BATCH = 4096

  /** How long one core call may scan, so a cancel lands within it. */
  const val BUDGET_MS = 8

  /** [matches] holds start and end pairs in document order. [limited]: a match attempt hit PCRE2's match limit. */
  class Result(val matches: IntArray, val limited: Boolean)

  /** Throws CancellationException once [cancel] answers true, which it is asked before each call into the core. */
  fun find(text: Long, search: Long, cancel: () -> Boolean = { false }): Result {
    val buffer = IntArray(BATCH * 2)
    // next, limited and budget_ms of the core's cp_search_scan.
    val scan = intArrayOf(0, 0, BUDGET_MS)
    var out = IntArray(0)
    var count = 0
    while (scan[0] >= 0) {
      if (cancel()) throw CancellationException()
      val n = CoreNative.searchFind(search, text, scan, buffer)
      if (count + n > out.size) out = out.copyOf(maxOf(out.size * 2, count + n))
      System.arraycopy(buffer, 0, out, count, n)
      count += n
    }
    return Result(out.copyOf(count), scan[1] != 0)
  }

  /** Frees a handle from [EditorCore.compiledSearch]. */
  fun release(search: Long) = CoreNative.searchRelease(search)

  /** Frees a handle from [EditorCore.textSnapshot]. */
  fun releaseText(text: Long) = CoreNative.textRelease(text)
}
