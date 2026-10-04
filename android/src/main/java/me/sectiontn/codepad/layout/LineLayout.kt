package me.sectiontn.codepad.layout

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.text.Layout
import android.text.SpannableString
import android.text.Spanned
import android.text.StaticLayout
import android.text.TextPaint
import android.text.style.ForegroundColorSpan
import android.text.style.LineHeightSpan
import android.text.style.StyleSpan
import android.text.style.TabStopSpan
import me.sectiontn.codepad.view.ThemeColors

/** Derived once per font change. Ascent and descent are padded so descent minus ascent equals rowHeight. */
class RowMetrics(paint: TextPaint, lineHeight: Float, tabSize: Int) {
  val fontHeight: Int
  val rowHeight: Int
  val ascent: Int
  val descent: Int
  val tabWidth: Int

  init {
    val fm = paint.fontMetricsInt
    fontHeight = fm.descent - fm.ascent
    rowHeight = Math.round(paint.textSize * lineHeight)
    val extra = rowHeight - fontHeight
    ascent = fm.ascent - extra / 2
    descent = fm.descent + (extra - extra / 2)
    tabWidth = Math.round(paint.measureText(" ") * tabSize)
  }
}

/** Pins every row to the grid so fallback fonts for emoji or CJK never change the row height. */
private class FixedRowSpan(private val ascent: Int, private val descent: Int) : LineHeightSpan {
  override fun chooseHeight(text: CharSequence, start: Int, end: Int, spanstartv: Int, v: Int, fm: Paint.FontMetricsInt) {
    fm.ascent = ascent
    fm.top = ascent
    fm.descent = descent
    fm.bottom = descent
  }
}

class LineLayout(
  text: CharSequence,
  spans: IntArray?,
  paint: TextPaint,
  theme: ThemeColors,
  wrapWidth: Int,
  tabSize: Int,
  metrics: RowMetrics,
) {
  val layout: StaticLayout

  init {
    val sp = SpannableString(text)
    val n = sp.length
    if (spans != null) {
      var i = 0
      while (i + 2 < spans.size) {
        val style = theme.styleFor(spans[i + 2])
        if (style != null) {
          sp.setSpan(ForegroundColorSpan(style.color), spans[i], spans[i + 1], Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          if (style.bold || style.italic) {
            val flag = if (style.bold && style.italic) Typeface.BOLD_ITALIC else if (style.bold) Typeface.BOLD else Typeface.ITALIC
            sp.setSpan(StyleSpan(flag), spans[i], spans[i + 1], Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
          }
        }
        i += 3
      }
    }
    if (n > 0) {
      sp.setSpan(FixedRowSpan(metrics.ascent, metrics.descent), 0, n, Spanned.SPAN_INCLUSIVE_INCLUSIVE)
      val tabs = text.count { it == '\t' }
      if (tabs > 0) {
        // StaticLayout honours listed stops and then falls back to a 20px default, so list enough of them.
        val stops = n / tabSize + tabs + 1
        for (k in 1..stops) sp.setSpan(TabStopSpan.Standard(k * metrics.tabWidth), 0, n, Spanned.SPAN_INCLUSIVE_INCLUSIVE)
      }
    }
    layout = StaticLayout.Builder.obtain(sp, 0, n, paint, if (wrapWidth > 0) wrapWidth else NO_WRAP_WIDTH)
      .setIncludePad(false)
      .setBreakStrategy(Layout.BREAK_STRATEGY_SIMPLE)
      .setHyphenationFrequency(Layout.HYPHENATION_FREQUENCY_NONE)
      .build()
  }

  val rowCount: Int get() = layout.lineCount

  fun width(): Float {
    var max = 0f
    for (row in 0 until layout.lineCount) max = maxOf(max, layout.getLineWidth(row))
    return max
  }

  fun draw(canvas: Canvas) = layout.draw(canvas)

  companion object {
    const val NO_WRAP_WIDTH = 1 shl 24
  }
}
