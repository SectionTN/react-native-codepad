package me.sectiontn.codepad.view

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import kotlin.math.roundToInt
import me.sectiontn.codepad.core.Decoration
import me.sectiontn.codepad.core.LineBackground
import me.sectiontn.codepad.core.Underline
import me.sectiontn.codepad.core.UnderlineStyle
import me.sectiontn.codepad.layout.RangeRects
import me.sectiontn.codepad.layout.RowGeometry
import me.sectiontn.codepad.layout.Viewport

/** Chrome's wavy underline in dp, measured at 14 px for thickness 1 to 4. */
object WaveGeometry {
  fun wavelength(thickness: Float): Float = 4f * thickness + 0.375f

  /** How far the centre line swings to either side. */
  fun amplitude(thickness: Float): Float = 0.875f * thickness

  /** How far the centre line sits below a solid line's top. */
  fun centre(thickness: Float): Float = thickness
}

/** Paints the app's line backgrounds and underlines. Decoration sizes are dp. */
class DecorationPainter(private val density: Float) {
  private val fill = Paint()
  private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
  private val path = Path()

  /** Full width tints over each line's text rows, drawn above the active line. */
  fun drawLineBackgrounds(canvas: Canvas, items: List<Decoration>, viewport: Viewport, width: Int, height: Int) {
    for (d in items) {
      if (d !is LineBackground) continue
      val top = viewport.lineTop(d.line)
      val bottom = top + viewport.heights.rows(d.line) * viewport.rowHeight
      if (bottom <= 0 || top >= height) continue
      fill.color = d.color
      canvas.drawRect(viewport.textAreaLeft.toFloat(), top.toFloat(), width.toFloat(), bottom.toFloat(), fill)
    }
  }

  /** [baseline] is the distance from a row's top to its baseline in pixels. */
  fun drawUnderlines(canvas: Canvas, items: List<Decoration>, g: RowGeometry, firstLine: Int, baseline: Int) {
    for (d in items) {
      if (d !is Underline) continue
      RangeRects.forEach(g, d.start, d.end, firstLine, padNewline = false) { left, top, right, _ ->
        val lineTop = top + baseline + d.offset * density
        if (d.style == UnderlineStyle.Solid) {
          // Whole pixels, so the line stays as crisp as a browser draws it.
          val y = lineTop.roundToInt().toFloat()
          fill.color = d.color
          canvas.drawRect(left, y, right, y + maxOf(1, (d.thickness * density).roundToInt()), fill)
        } else {
          wave(canvas, left, right, lineTop + WaveGeometry.centre(d.thickness) * density, d)
        }
      }
    }
  }

  // One quadratic per half wave, leaving the left edge on the centre line heading down.
  private fun wave(canvas: Canvas, left: Float, right: Float, centre: Float, d: Underline) {
    val half = WaveGeometry.wavelength(d.thickness) * density / 2f
    val amp = WaveGeometry.amplitude(d.thickness) * density
    stroke.color = d.color
    stroke.strokeWidth = d.thickness * density
    path.rewind()
    path.moveTo(left, centre)
    var x = left
    var down = true
    while (x < right) {
      path.quadTo(x + half / 2f, centre + if (down) 2f * amp else -2f * amp, x + half, centre)
      x += half
      down = !down
    }
    canvas.save()
    canvas.clipRect(left, centre - amp - stroke.strokeWidth, right, centre + amp + stroke.strokeWidth)
    canvas.drawPath(path, stroke)
    canvas.restore()
  }
}
