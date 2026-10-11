package me.sectiontn.codepad.syntax

/** Sorts unit pairs by start and merges the ones that overlap or touch, so a burst of edits stays one region. */
internal fun coalesce(pairs: IntArray): IntArray {
  if (pairs.size <= 2) return pairs
  val order = (0 until pairs.size / 2).sortedBy { pairs[it * 2] }
  val out = IntArray(pairs.size)
  var m = 0
  for (idx in order) {
    val s = pairs[idx * 2]
    val e = pairs[idx * 2 + 1]
    if (m > 0 && s <= out[m - 1]) {
      if (e > out[m - 1]) out[m - 1] = e
    } else {
      out[m] = s
      out[m + 1] = e
      m += 2
    }
  }
  return if (m == out.size) out else out.copyOf(m)
}
