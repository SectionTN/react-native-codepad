package me.sectiontn.codepad.syntax

/** A line's (startColumn, endColumn, styleId) triples after a change inside it, painted until the parse lands. */
internal fun shiftSpans(spans: IntArray, start: Int, removed: Int, inserted: Int): IntArray {
  val (out, count) = CoreNative.fill(IntArray(spans.size + 3)) { CoreNative.shiftSpans(spans, start, removed, inserted, it) }
  return out.copyOf(count)
}
