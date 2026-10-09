package me.sectiontn.codepad.syntax

import me.sectiontn.codepad.core.Document

/** Turns query captures from a snapshot into per line (startColumn, endColumn, styleId) triples. */
class Highlighter(private val language: LoadedLanguage) {
  private class Hit(val start: Int, val end: Int, val styleId: Int, val layer: Int, val pattern: Int)

  fun spans(snapshot: Snapshot, doc: Document, firstLine: Int, lastLine: Int): Array<IntArray> {
    val rangeStart = doc.lineStart(firstLine)
    val rangeEnd = doc.lineEnd(lastLine)
    val hits = ArrayList<Hit>()
    val read: (TSNodeRef) -> String = { n -> doc.text(n.startUnit, n.endUnit) }
    collect(language.highlights, snapshot.tree, rangeStart, rangeEnd, read, 0, hits)
    for ((i, inj) in snapshot.injected.withIndex()) {
      collect(inj.language.highlights, inj.tree, rangeStart, rangeEnd, read, i + 1, hits)
    }
    // Same precedence as nvim: injections paint over the host, then later starts win, then later patterns.
    hits.sortWith(compareBy<Hit>({ it.layer }, { it.start }, { it.pattern }))
    val lineCount = lastLine - firstLine + 1
    val paint = Array(lineCount) { IntArray(doc.lineLength(firstLine + it)) { -1 } }
    for (h in hits) {
      val s = maxOf(h.start, rangeStart)
      val e = minOf(h.end, rangeEnd)
      if (s >= e) continue
      var line = doc.lineAt(s)
      while (line <= lastLine) {
        val ls = doc.lineStart(line)
        val from = maxOf(s, ls) - ls
        val to = minOf(e, doc.lineEnd(line)) - ls
        val row = paint[line - firstLine]
        for (c in from until minOf(to, row.size)) row[c] = h.styleId
        if (e <= doc.lineEnd(line) + 1) break
        line++
      }
    }
    return Array(lineCount) { encode(paint[it]) }
  }

  private fun collect(
    compiled: CompiledQuery,
    tree: Tree,
    start: Int,
    end: Int,
    read: (TSNodeRef) -> String,
    layer: Int,
    out: MutableList<Hit>,
  ) {
    QueryCursor().use { cursor ->
      cursor.exec(compiled.query, tree.rootNode())
      cursor.setUnitRange(start, end)
      val capture = Capture()
      val rejected = HashSet<Int>()
      val accepted = HashSet<Int>()
      while (cursor.nextCapture(capture)) {
        if (capture.matchId in rejected) continue
        if (capture.matchId !in accepted && compiled.evaluator.hasPredicates(capture.patternIndex)) {
          val all = ArrayList<CaptureNode>(cursor.matchCaptureCount)
          for (i in 0 until cursor.matchCaptureCount) {
            val c = Capture()
            cursor.matchCapture(i, c)
            all.add(CaptureNode(c.captureIndex, c.node))
          }
          if (!compiled.evaluator.matches(capture.patternIndex, all, read)) {
            rejected.add(capture.matchId)
            cursor.removeMatch(capture.matchId)
            continue
          }
          accepted.add(capture.matchId)
        }
        val name = compiled.query.captureNames[capture.captureIndex]
        if (name.startsWith("_") || name in MARKERS) continue
        val style = if (name == "none") -1 else compiled.styleIds[capture.captureIndex]
        out.add(Hit(capture.node.startUnit, capture.node.endUnit, style, layer, capture.patternIndex))
      }
    }
  }

  private fun encode(row: IntArray): IntArray {
    val out = ArrayList<Int>()
    var i = 0
    while (i < row.size) {
      val style = row[i]
      var j = i + 1
      while (j < row.size && row[j] == style) j++
      if (style >= 0) {
        out.add(i)
        out.add(j)
        out.add(style)
      }
      i = j
    }
    return out.toIntArray()
  }

  private companion object {
    // nvim reads spell and conceal as editor hints. They never carry a color.
    val MARKERS = setOf("spell", "nospell", "conceal")
  }
}
