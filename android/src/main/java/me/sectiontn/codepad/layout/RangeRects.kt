package me.sectiontn.codepad.layout

/** What a row walk needs from the view: line lookup, row placement and the horizontal extent of a row span. */
interface RowGeometry {
  val rowHeight: Int
  val spaceWidth: Float
  val viewHeight: Int

  /** x of column 0 in view space. */
  val originX: Float

  fun lineAt(offset: Int): Int
  fun lineStart(line: Int): Int
  fun lineLength(line: Int): Int
  fun lineTop(line: Int): Int

  /** 0 when the line has no layout yet. */
  fun rowCount(line: Int): Int

  fun rowSpans(line: Int, from: Int, to: Int, out: (row: Int, left: Float, right: Float) -> Unit)
}

object RangeRects {
  /**
   * Calls [out] once per row rect of [start, end) from [firstLine] down to the view bottom. The last row of
   * every line but the last one gets a space of width so the newline shows; empty spans are skipped.
   */
  fun forEach(g: RowGeometry, start: Int, end: Int, firstLine: Int, out: (left: Float, top: Float, right: Float, bottom: Float) -> Unit) {
    val startLine = g.lineAt(start)
    val endLine = g.lineAt(end)
    if (endLine < firstLine) return
    for (line in maxOf(startLine, firstLine)..endLine) {
      val top = g.lineTop(line)
      if (top >= g.viewHeight) break
      val rows = g.rowCount(line)
      if (rows == 0) break
      val ls = g.lineStart(line)
      val from = if (line == startLine) start - ls else 0
      val to = if (line == endLine) end - ls else g.lineLength(line)
      val lastRow = rows - 1
      g.rowSpans(line, from, to) { row, left, right ->
        val r = if (line != endLine && row == lastRow) right + g.spaceWidth else right
        if (r > left) {
          val y = (top + row * g.rowHeight).toFloat()
          out(g.originX + left, y, g.originX + r, y + g.rowHeight)
        }
      }
    }
  }
}
