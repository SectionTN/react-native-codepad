package me.sectiontn.codepad.view

import android.graphics.Canvas
import android.graphics.Paint
import me.sectiontn.codepad.core.Range
import me.sectiontn.codepad.core.SearchSession
import me.sectiontn.codepad.layout.RangeRects
import me.sectiontn.codepad.layout.RowGeometry

/** Paints the fills under the text: selection, search matches and the bracket pair. */
class Decorations {
  private val fill = Paint()

  fun drawRange(canvas: Canvas, g: RowGeometry, start: Int, end: Int, firstLine: Int, color: Int) {
    fill.color = color
    RangeRects.forEach(g, start, end, firstLine) { left, top, right, bottom -> canvas.drawRect(left, top, right, bottom, fill) }
  }

  /** Paints the matches overlapping [window]; the one equal to [active] takes [activeColor]. */
  fun drawMatches(
    canvas: Canvas,
    g: RowGeometry,
    matches: IntArray,
    active: Range?,
    firstLine: Int,
    window: Range,
    color: Int,
    activeColor: Int,
  ) {
    var i = SearchSession.firstEndingAfter(matches, window.start) * 2
    while (i < matches.size && matches[i] <= window.end) {
      val start = matches[i]
      val end = matches[i + 1]
      val current = active != null && active.start == start && active.end == end
      drawRange(canvas, g, start, end, firstLine, if (current) activeColor else color)
      i += 2
    }
  }

  fun drawBrackets(canvas: Canvas, g: RowGeometry, pair: IntArray, firstLine: Int, color: Int) {
    drawRange(canvas, g, pair[0], pair[0] + 1, firstLine, color)
    drawRange(canvas, g, pair[1], pair[1] + 1, firstLine, color)
  }
}
