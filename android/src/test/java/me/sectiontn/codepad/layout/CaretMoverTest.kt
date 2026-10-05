package me.sectiontn.codepad.layout

import me.sectiontn.codepad.core.Document
import org.junit.Assert.assertEquals
import org.junit.Test

class CaretMoverTest {
  /** Monospace rows of [width] columns, 10 px per char. */
  private class Mono(private val doc: Document, private val width: Int) : LineGeometry {
    override fun rows(line: Int): Int = maxOf(1, (doc.lineLength(line) + width - 1) / width)
    override fun rowOf(line: Int, column: Int): Int = minOf(column / width, rows(line) - 1)
    override fun caretX(line: Int, column: Int): Float = (column - rowOf(line, column) * width) * 10f
    override fun columnAt(line: Int, row: Int, x: Float): Int {
      val rowEnd = minOf(doc.lineLength(line), (row + 1) * width)
      return minOf(rowEnd, row * width + Math.round(x / 10f))
    }
  }

  @Test
  fun downKeepsTheGoalColumnAcrossShortLines() {
    val doc = Document("abcdef\nxy\nlonger line")
    val g = Mono(doc, 100)
    val first = CaretMover.move(doc, g, 4, 1, null)
    assertEquals(doc.lineStart(1) + 2, first.offset)
    assertEquals(40f, first.goalX)
    val second = CaretMover.move(doc, g, first.offset, 1, first.goalX)
    assertEquals(doc.lineStart(2) + 4, second.offset)
    assertEquals(40f, second.goalX)
  }

  @Test
  fun upAndDownCrossWrappedRows() {
    val doc = Document("abcdefgh\nij")
    val g = Mono(doc, 4)
    assertEquals(5, CaretMover.move(doc, g, 1, 1, null).offset)
    assertEquals(doc.lineStart(1) + 1, CaretMover.move(doc, g, 5, 1, null).offset)
    assertEquals(1, CaretMover.move(doc, g, 5, -1, null).offset)
    assertEquals(5, CaretMover.move(doc, g, doc.lineStart(1) + 1, -1, null).offset)
  }

  @Test
  fun pagesMoveSeveralRows() {
    val doc = Document("a\nb\nc\nd\ne")
    val g = Mono(doc, 100)
    assertEquals(doc.lineStart(3), CaretMover.move(doc, g, 0, 3, null).offset)
    assertEquals(doc.lineStart(1), CaretMover.move(doc, g, doc.lineStart(3), -2, null).offset)
  }

  @Test
  fun pastTheEndsClampsToTheDocument() {
    val doc = Document("ab\ncd")
    val g = Mono(doc, 100)
    assertEquals(0, CaretMover.move(doc, g, 1, -1, null).offset)
    assertEquals(doc.length, CaretMover.move(doc, g, 1, 5, null).offset)
    assertEquals(10f, CaretMover.move(doc, g, 1, -1, null).goalX)
  }
}
