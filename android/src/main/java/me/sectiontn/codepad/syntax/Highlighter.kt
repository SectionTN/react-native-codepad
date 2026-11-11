package me.sectiontn.codepad.syntax

import me.sectiontn.codepad.core.Document

/** Turns a snapshot into per line (startColumn, endColumn, styleId) triples through the core. */
open class Highlighter(val language: LoadedLanguage) {
  // Reused across calls on the main thread, grown when the core asks for more.
  private var buffer = IntArray(4096)

  open fun spans(snapshot: Snapshot, doc: Document, firstLine: Int, lastLine: Int): Array<IntArray> {
    val start = doc.lineStart(firstLine)
    val count = fill { CoreNative.highlight(snapshot.pointer, firstLine, lastLine, start, it) }
    val cursor = intArrayOf(0)
    return lines(lastLine - firstLine + 1, cursor, count)
  }

  /** One draw's dirty runs, flat inclusive [lo, hi, ...], and the spans of every line in them, in order. */
  fun frame(snapshot: Snapshot, doc: Document, first: Int, last: Int, applied: Int, useChanged: Boolean, entries: IntArray): Pair<IntArray, Array<IntArray>> {
    val start = doc.lineStart(first)
    val count = fill { CoreNative.frame(snapshot.pointer, first, last, start, applied, useChanged, entries, it) }
    if (count == 0) return IntArray(0) to emptyArray()
    val runCount = buffer[0]
    val runs = buffer.copyOfRange(1, 1 + runCount * 2)
    var lineCount = 0
    for (r in 0 until runCount) lineCount += runs[r * 2 + 1] - runs[r * 2] + 1
    return runs to lines(lineCount, intArrayOf(1 + runCount * 2), count)
  }

  private inline fun fill(call: (IntArray) -> Int): Int {
    val (out, count) = CoreNative.fill(buffer, call)
    buffer = out
    return count
  }

  /** Decodes n lines of (count, triples...) from the buffer at cursor[0]. */
  private fun lines(n: Int, cursor: IntArray, count: Int): Array<IntArray> = Array(n) {
    var i = cursor[0]
    if (i >= count) return@Array IntArray(0)
    val triples = buffer[i]
    i++
    val row = buffer.copyOfRange(i, i + triples * 3)
    cursor[0] = i + triples * 3
    row
  }

  companion object {
    /** No cached layout for a line, as opposed to -1 for a line laid out plain. */
    const val NO_ENTRY = Int.MIN_VALUE
  }
}
