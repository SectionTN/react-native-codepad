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

  /** [matches] holds start and end pairs in document order. [limited]: a match attempt hit PCRE2's match limit. */
  class Result(val matches: IntArray, val limited: Boolean)

  /** Throws CancellationException once [cancel] answers true, which it is asked before each batch of matches. */
  fun find(text: Long, search: Long, cancel: () -> Boolean = { false }): Result {
    val buffer = IntArray(BATCH * 2)
    var out = IntArray(0)
    var count = 0
    var from = 0
    while (true) {
      if (cancel()) throw CancellationException()
      val n = CoreNative.searchFind(search, text, from, buffer)
      if (n < 0) return Result(out.copyOf(count), true)
      if (count + n > out.size) out = out.copyOf(maxOf(out.size * 2, count + n))
      System.arraycopy(buffer, 0, out, count, n)
      count += n
      if (n < buffer.size) return Result(out.copyOf(count), false)
      from = buffer[n - 1]
    }
  }

  /** Frees a handle from [EditorCore.compiledSearch]. */
  fun release(search: Long) = CoreNative.searchRelease(search)

  /** Frees a handle from [EditorCore.textSnapshot]. */
  fun releaseText(text: Long) = CoreNative.textRelease(text)
}
