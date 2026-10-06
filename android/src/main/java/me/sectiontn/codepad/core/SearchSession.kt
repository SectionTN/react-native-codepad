package me.sectiontn.codepad.core

import java.util.regex.Pattern

/** The compiled query and its matches for one document revision, packed as start and end pairs. */
class SearchSession(val query: SearchQuery, val pattern: Pattern) {
  var matches: IntArray = EMPTY
  var revision: Int = -1
  val count: Int get() = matches.size / 2

  /** Index of the first match starting at or after [offset], else [count]. */
  fun indexAtOrAfter(offset: Int): Int {
    var lo = 0
    var hi = count
    while (lo < hi) {
      val mid = (lo + hi) ushr 1
      if (matches[mid * 2] < offset) lo = mid + 1 else hi = mid
    }
    return lo
  }

  /** Index of the match equal to [range], else -1. */
  fun indexOf(range: Range): Int {
    val i = indexAtOrAfter(range.start)
    return if (i < count && matches[i * 2] == range.start && matches[i * 2 + 1] == range.end) i else -1
  }

  /** The match after [selection], skipping the selected one, wrapping to the first; -1 without matches. */
  fun nextIndex(selection: Selection): Int {
    if (count == 0) return -1
    var index = indexAtOrAfter(selection.min)
    if (index < count && matches[index * 2] == selection.min && matches[index * 2 + 1] == selection.max) index++
    return if (index >= count) 0 else index
  }

  /** The match before [selection], wrapping to the last; -1 without matches. */
  fun previousIndex(selection: Selection): Int {
    if (count == 0) return -1
    val index = indexAtOrAfter(selection.min) - 1
    return if (index < 0) count - 1 else index
  }

  companion object {
    val EMPTY = IntArray(0)

    /** Shifts the pairs past [change] and drops the ones it touched. */
    fun mapThrough(matches: IntArray, change: Change): IntArray {
      val out = IntArray(matches.size)
      var n = 0
      var i = 0
      while (i < matches.size) {
        val s = matches[i]
        val e = matches[i + 1]
        if (e <= change.start) {
          out[n++] = s
          out[n++] = e
        } else if (s >= change.end) {
          out[n++] = s + change.delta
          out[n++] = e + change.delta
        }
        i += 2
      }
      return if (n == out.size) out else out.copyOf(n)
    }

    /** Index of the first match ending after [offset], else the count. */
    fun firstEndingAfter(matches: IntArray, offset: Int): Int {
      var lo = 0
      var hi = matches.size / 2
      while (lo < hi) {
        val mid = (lo + hi) ushr 1
        if (matches[mid * 2 + 1] <= offset) lo = mid + 1 else hi = mid
      }
      return lo
    }
  }
}
