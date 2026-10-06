package me.sectiontn.codepad.layout

import org.junit.Assert.assertEquals
import org.junit.Test

class RangeRectsTest {
  /** Monospace lines at 10 px per character, [perRow] characters per row when wrapping. */
  private class Fake(
    private val lines: List<String>,
    private val perRow: Int = 1_000_000,
    override val viewHeight: Int = 1000,
  ) : RowGeometry {
    override val rowHeight = 20
    override val spaceWidth = 10f
    override val originX = 0f
    private val starts = IntArray(lines.size).also {
      var offset = 0
      for (i in lines.indices) {
        it[i] = offset
        offset += lines[i].length + 1
      }
    }

    override fun lineAt(offset: Int): Int {
      var line = 0
      while (line + 1 < lines.size && starts[line + 1] <= offset) line++
      return line
    }

    override fun lineStart(line: Int) = starts[line]
    override fun lineLength(line: Int) = lines[line].length
    override fun lineTop(line: Int) = (0 until line).sumOf { rowCount(it) } * rowHeight
    override fun rowCount(line: Int) = maxOf(1, (lines[line].length + perRow - 1) / perRow)

    override fun rowSpans(line: Int, from: Int, to: Int, out: (row: Int, left: Float, right: Float) -> Unit) {
      val firstRow = minOf(from / perRow, rowCount(line) - 1)
      val lastRow = minOf(to / perRow, rowCount(line) - 1)
      for (row in firstRow..lastRow) {
        val rowStart = row * perRow
        val rowEnd = minOf(lines[line].length, rowStart + perRow)
        val left = if (row == firstRow) (from - rowStart) * 10f else 0f
        val right = if (row == lastRow) (to - rowStart) * 10f else (rowEnd - rowStart) * 10f
        out(row, left, right)
      }
    }
  }

  private fun rects(g: RowGeometry, start: Int, end: Int, firstLine: Int = 0): List<List<Float>> {
    val out = ArrayList<List<Float>>()
    RangeRects.forEach(g, start, end, firstLine) { l, t, r, b -> out.add(listOf(l, t, r, b)) }
    return out
  }

  private fun rect(l: Int, t: Int, r: Int, b: Int) = listOf(l.toFloat(), t.toFloat(), r.toFloat(), b.toFloat())

  @Test
  fun singleLineRange() {
    assertEquals(listOf(rect(10, 0, 30, 20)), rects(Fake(listOf("abcdef")), 1, 3))
  }

  @Test
  fun multiLineRangeAddsTheNewlineWidthOnMiddleLines() {
    assertEquals(
      listOf(rect(10, 0, 30, 20), rect(0, 20, 30, 40), rect(0, 40, 10, 60)),
      rects(Fake(listOf("ab", "cd", "ef")), 1, 7),
    )
  }

  @Test
  fun rangeEndingAtLineStartPaintsNothingThere() {
    assertEquals(listOf(rect(0, 0, 30, 20)), rects(Fake(listOf("ab", "cd")), 0, 3))
  }

  @Test
  fun emptyMiddleLineStillShowsItsNewline() {
    assertEquals(
      listOf(rect(0, 0, 20, 20), rect(0, 20, 10, 40), rect(0, 40, 10, 60)),
      rects(Fake(listOf("a", "", "b")), 0, 4),
    )
  }

  @Test
  fun linesAboveFirstLineAreSkipped() {
    assertEquals(listOf(rect(0, 20, 10, 40)), rects(Fake(listOf("ab", "cd")), 0, 4, firstLine = 1))
  }

  @Test
  fun stopsAtTheViewBottom() {
    assertEquals(listOf(rect(0, 0, 30, 20)), rects(Fake(listOf("ab", "cd"), viewHeight = 20), 0, 4))
  }

  @Test
  fun wrappedRowsUseTheRowOffsets() {
    assertEquals(
      listOf(rect(10, 0, 30, 20), rect(0, 20, 20, 40)),
      rects(Fake(listOf("abcdef"), perRow = 3), 1, 5),
    )
  }
}
