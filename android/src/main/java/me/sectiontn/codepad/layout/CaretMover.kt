package me.sectiontn.codepad.layout

import me.sectiontn.codepad.core.Document

/** Visual rows of laid out lines, answered by the view from its layout cache. */
interface LineGeometry {
  fun rows(line: Int): Int
  fun rowOf(line: Int, column: Int): Int
  fun caretX(line: Int, column: Int): Float
  fun columnAt(line: Int, row: Int, x: Float): Int
}

/** Up, down and page movement by visual rows with a remembered goal x. */
object CaretMover {
  data class Result(val offset: Int, val goalX: Float)

  /** Moves [rows] rows from [offset] (negative is up), clamping to the document ends. */
  fun move(doc: Document, geometry: LineGeometry, offset: Int, rows: Int, goalX: Float?): Result {
    val pos = doc.offsetToPosition(offset)
    var line = pos.line
    var row = geometry.rowOf(line, pos.column)
    val x = goalX ?: geometry.caretX(line, pos.column)
    var remaining = rows
    while (remaining < 0) {
      if (row > 0) {
        row--
      } else {
        if (line == 0) return Result(0, x)
        line--
        row = geometry.rows(line) - 1
      }
      remaining++
    }
    while (remaining > 0) {
      if (row < geometry.rows(line) - 1) {
        row++
      } else {
        if (line == doc.lineCount - 1) return Result(doc.length, x)
        line++
        row = 0
      }
      remaining--
    }
    return Result(doc.lineStart(line) + geometry.columnAt(line, row, x), x)
  }
}
