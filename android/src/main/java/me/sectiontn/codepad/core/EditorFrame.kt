package me.sectiontn.codepad.core

import me.sectiontn.codepad.syntax.CoreNative

/**
 * One draw's reads from the core: the document and selection header, the window's line starts, and the lines to
 * lay out with their spans and text.
 */
class EditorFrame internal constructor(
  val revision: Int,
  val length: Int,
  val lineCount: Int,
  val anchor: Int,
  val head: Int,
  val caretLine: Int,
  val decorationsVersion: Int,
  val history: Int,
  /** The window, clamped to the document. */
  val first: Int,
  val last: Int,
  /** Flat inclusive [lo, hi, ...]: the lines to lay out. */
  val runs: IntArray,
  /** One entry per run line, in order. Empty for every line when the frame had no usable snapshot. */
  val spans: Array<IntArray>,
  private val starts: IntArray,
  private val runLines: IntArray,
  private val texts: Array<String>,
) {
  /** first..last + 1. The line after the last one starts at length + 1. */
  fun lineStart(line: Int): Int? = if (line in first..last + 1) starts[line - first] else null

  fun lineLength(line: Int): Int? = if (line in first..last) starts[line + 1 - first] - starts[line - first] - 1 else null

  /** Null for an offset outside the window. */
  fun lineAt(offset: Int): Int? {
    if (offset < starts[0] || offset >= starts[starts.size - 1]) return null
    var lo = 0
    var hi = starts.size - 1
    while (lo + 1 < hi) {
      val mid = (lo + hi) ushr 1
      if (starts[mid] <= offset) lo = mid else hi = mid
    }
    return first + lo
  }

  /** The text of a run line. */
  fun text(line: Int): String? {
    val i = runLines.indexOf(line)
    return if (i < 0) null else texts[i]
  }

  companion object {
    /** CP_NO_ENTRY: a line with no layout. */
    const val NO_ENTRY = Int.MIN_VALUE
  }
}

/** Makes the frame call, with buffers kept across draws and grown when the core asks for more. */
class FrameReader(ints: Int = 4096, units: Int = 16384) {
  private var ints = IntArray(maxOf(ints, 1))
  private var units = CharArray(maxOf(units, 1))
  private val textLength = IntArray(1)

  /** [snapshot] is a snapshot pointer or 0. [entries] holds the cached revision of each line of [first, last]. */
  fun read(core: EditorCore, snapshot: Long, first: Int, last: Int, applied: Int, useChanged: Boolean, entries: IntArray): EditorFrame {
    while (true) {
      val needed = CoreNative.editorFrame(core.handle(), snapshot, first, last, applied, useChanged, entries, ints, units, textLength)
      if (needed <= ints.size && textLength[0] <= units.size) return decode(first, last)
      if (needed > ints.size) ints = IntArray(needed)
      if (textLength[0] > units.size) units = CharArray(textLength[0])
    }
  }

  private fun decode(first: Int, last: Int): EditorFrame {
    var i = 0
    fun next(): Int = ints[i++]
    val revision = next()
    val length = next()
    val lineCount = next()
    val anchor = next()
    val head = next()
    val caretLine = next()
    val decorationsVersion = next()
    val history = next()
    val lo = first.coerceIn(0, lineCount - 1)
    val hi = last.coerceIn(lo, lineCount - 1)
    val starts = IntArray(hi - lo + 2) { next() }
    val runs = IntArray(next() * 2) { next() }
    var count = 0
    for (r in runs.indices step 2) count += runs[r + 1] - runs[r] + 1
    val runLines = IntArray(count)
    var n = 0
    for (r in runs.indices step 2) for (line in runs[r]..runs[r + 1]) runLines[n++] = line
    val spans = Array(count) { IntArray(next() * 3) { next() } }
    val texts = Array(count) {
      val offset = next()
      String(units, offset, next())
    }
    return EditorFrame(
      revision, length, lineCount, anchor, head, caretLine, decorationsVersion, history, lo, hi, runs, spans, starts,
      runLines, texts,
    )
  }
}
