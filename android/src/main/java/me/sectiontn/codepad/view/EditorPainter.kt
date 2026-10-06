package me.sectiontn.codepad.view

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.text.TextPaint
import me.sectiontn.codepad.core.Document
import me.sectiontn.codepad.layout.LineLayout
import me.sectiontn.codepad.layout.RowMetrics
import me.sectiontn.codepad.layout.Viewport

/** Draws the text layer and its chrome for one frame: active line, text, gutter, caret and placeholder. */
internal class EditorPainter(
  private val viewport: Viewport,
  private val layoutOf: (line: Int) -> LineLayout?,
  private val paint: TextPaint,
  private val gutterPaint: TextPaint,
  private val density: Float,
) {
  var theme: ThemeColors = ThemeColors.default
  private val fill = Paint()

  fun drawActiveLine(canvas: Canvas, line: Int, width: Int, height: Int) {
    val top = viewport.lineTop(line)
    val bottom = top + viewport.heights.rows(line) * viewport.rowHeight
    if (bottom <= 0 || top >= height) return
    fill.color = theme.activeLine
    canvas.drawRect(viewport.textAreaLeft.toFloat(), top.toFloat(), width.toFloat(), bottom.toFloat(), fill)
  }

  /** Returns the last line drawn. */
  fun drawText(canvas: Canvas, doc: Document, firstLine: Int, width: Int, height: Int): Int {
    var lastLine = firstLine
    canvas.save()
    canvas.clipRect(viewport.textAreaLeft, 0, width, height)
    var line = firstLine
    while (line < doc.lineCount) {
      val top = viewport.lineTop(line)
      if (top >= height) break
      val layout = layoutOf(line) ?: break
      canvas.save()
      canvas.translate(viewport.viewX(0f), top.toFloat())
      layout.draw(canvas)
      canvas.restore()
      lastLine = line
      line++
    }
    canvas.restore()
    return lastLine
  }

  fun drawGutter(canvas: Canvas, m: RowMetrics, firstLine: Int, lastLine: Int, caretLine: Int, height: Int) {
    val left = viewport.insetLeft.toFloat()
    val right = (viewport.insetLeft + viewport.gutterWidth).toFloat()
    fill.color = theme.gutterBackground
    canvas.drawRect(left, 0f, right, height.toFloat(), fill)
    val x = right - dp(GUTTER_PADDING_DP)
    for (line in firstLine..lastLine) {
      gutterPaint.color = if (line == caretLine) theme.gutterActiveForeground else theme.gutterForeground
      canvas.drawText((line + 1).toString(), x, (viewport.lineTop(line) - m.ascent).toFloat(), gutterPaint)
    }
  }

  /** The caret rect in view pixels, null while the line has no layout. */
  fun caretRect(m: RowMetrics, line: Int, column: Int): RectF? {
    val layout = layoutOf(line) ?: return null
    val x = viewport.viewX(layout.caretX(column))
    val top = (viewport.lineTop(line) + layout.rowOf(column) * m.rowHeight).toFloat()
    return RectF(x, top, x + dp(CARET_WIDTH_DP), top + m.rowHeight)
  }

  fun drawCaret(canvas: Canvas, rect: RectF, height: Int) {
    if (rect.bottom <= 0f || rect.top >= height || rect.left < viewport.textAreaLeft) return
    fill.color = theme.cursor
    canvas.drawRect(rect.left - 1f, rect.top, rect.right - 1f, rect.bottom, fill)
  }

  fun drawPlaceholder(canvas: Canvas, m: RowMetrics, text: String) {
    paint.color = theme.gutterForeground
    canvas.drawText(text, viewport.viewX(0f), (viewport.lineTop(0) - m.ascent).toFloat(), paint)
    paint.color = theme.foreground
  }

  private fun dp(value: Float): Int = Math.round(value * density)

  companion object {
    const val GUTTER_PADDING_DP = 8f
    const val CARET_WIDTH_DP = 2f
  }
}
