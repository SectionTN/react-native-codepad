package me.sectiontn.codepad.core

/** The painted matches: the core owns the search, the view keeps the last result and shifts it through edits. */
object SearchSession {
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
