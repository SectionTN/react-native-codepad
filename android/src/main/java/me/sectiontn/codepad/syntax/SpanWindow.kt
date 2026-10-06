package me.sectiontn.codepad.syntax

import me.sectiontn.codepad.core.Document

/**
 * Answers whether an offset sits in a string or a comment from the highlighter's own captures, computed
 * in windows of [windowLines] lines as the bracket scan moves. One instance serves one scan.
 */
class SpanWindow(
  private val snapshot: Snapshot,
  private val highlighter: Highlighter,
  private val doc: Document,
  private val windowLines: Int = 256,
) {
  private val windows = HashMap<Int, Array<IntArray>>()

  fun skip(offset: Int): Boolean {
    val line = doc.lineAt(offset)
    val index = line / windowLines
    val lo = index * windowLines
    val spans = windows.getOrPut(index) {
      highlighter.spans(snapshot, doc, lo, minOf(doc.lineCount - 1, lo + windowLines - 1))
    }
    val runs = spans[line - lo]
    val column = offset - doc.lineStart(line)
    var i = 0
    while (i < runs.size) {
      if (column < runs[i]) return false
      if (column < runs[i + 1]) {
        val name = StyleTable.name(runs[i + 2])
        return name.startsWith("string") || name.startsWith("comment")
      }
      i += 3
    }
    return false
  }
}
