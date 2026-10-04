package me.sectiontn.codepad.layout

import org.junit.Assert.assertEquals
import org.junit.Test

class HeightMapTest {
  @Test
  fun unmeasuredLinesCountOneRow() {
    val h = HeightMap(5)
    assertEquals(5, h.totalRows)
    assertEquals(3, h.rowStart(3))
    assertEquals(5, h.rowStart(5))
    assertEquals(4, h.lineAtRow(4))
    assertEquals(4, h.lineAtRow(99))
    assertEquals(0, h.lineAtRow(-1))
  }

  @Test
  fun measuredRowsShiftLaterLines() {
    val h = HeightMap(5)
    assertEquals(1, h.setRows(1, 3))
    assertEquals(3, h.setRows(1, 3))
    assertEquals(7, h.totalRows)
    assertEquals(4, h.rowStart(2))
    assertEquals(1, h.lineAtRow(1))
    assertEquals(1, h.lineAtRow(3))
    assertEquals(2, h.lineAtRow(4))
    assertEquals(4, h.lineAtRow(6))
  }

  @Test
  fun replaceLinesKeepsTheTail() {
    val h = HeightMap(4)
    h.setRows(3, 2)
    h.replaceLines(1, 1, 3)
    assertEquals(6, h.lineCount)
    assertEquals(1, h.rows(1))
    assertEquals(1, h.rows(3))
    assertEquals(2, h.rows(5))
    assertEquals(7, h.totalRows)
    h.replaceLines(0, 3, 1)
    assertEquals(4, h.lineCount)
    assertEquals(2, h.rows(3))
    assertEquals(5, h.totalRows)
    assertEquals(3, h.rowStart(3))
  }

  @Test
  fun resetAllForgetsMeasurements() {
    val h = HeightMap(3)
    h.setRows(0, 4)
    assertEquals(6, h.totalRows)
    h.resetAll()
    assertEquals(3, h.totalRows)
    assertEquals(1, h.rowStart(1))
  }

  @Test
  fun growsPastTheInitialCapacity() {
    val h = HeightMap(1)
    h.replaceLines(0, 1, 40)
    assertEquals(40, h.lineCount)
    assertEquals(40, h.totalRows)
    assertEquals(39, h.rowStart(39))
    h.replaceLines(39, 1, 30)
    assertEquals(69, h.lineCount)
    assertEquals(69, h.totalRows)
  }
}
