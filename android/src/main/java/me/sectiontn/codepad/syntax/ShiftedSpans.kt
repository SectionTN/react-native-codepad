package me.sectiontn.codepad.syntax

/**
 * A line's (startColumn, endColumn, styleId) triples after a change inside it replaced `removed` units at `start`
 * with `inserted` units: a span containing the edit, or ending at it with nothing removed, grows; one cut by it keeps
 * its parts before and after; later spans move. The parse replaces the guess one frame later.
 */
internal fun shiftSpans(spans: IntArray, start: Int, removed: Int, inserted: Int): IntArray {
  val delta = inserted - removed
  val endR = start + removed
  val out = ArrayList<Int>(spans.size + 3)
  fun add(s: Int, e: Int, style: Int) {
    if (s < e) {
      out.add(s)
      out.add(e)
      out.add(style)
    }
  }
  var i = 0
  while (i + 2 < spans.size) {
    val s = spans[i]
    val e = spans[i + 1]
    val style = spans[i + 2]
    i += 3
    when {
      e < start || (e == start && removed > 0) -> add(s, e, style)
      s >= endR && !(s == start && removed == 0 && e == start) -> add(s + delta, e + delta, style)
      s < start && e >= endR -> add(s, e + delta, style)
      e == start -> add(s, e + delta, style)
      else -> {
        if (s < start) add(s, start, style)
        if (e > endR) add(endR + delta, e + delta, style)
      }
    }
  }
  return out.toIntArray()
}
