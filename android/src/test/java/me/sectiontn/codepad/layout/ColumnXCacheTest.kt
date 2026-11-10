package me.sectiontn.codepad.layout

import org.junit.Assert.assertEquals
import org.junit.Test

// Every frame asks the same columns for underlines and fills, so a second ask must not re-measure the line.
class ColumnXCacheTest {
  @Test
  fun aColumnIsMeasuredOnce() {
    var calls = 0
    val cache = ColumnXCache { calls++; it * 1.5f }
    assertEquals(7.5f, cache.x(5), 0f)
    assertEquals(7.5f, cache.x(5), 0f)
    assertEquals(10.5f, cache.x(7), 0f)
    assertEquals(2, calls)
  }

  @Test
  fun everyColumnKeepsItsValueAcrossGrowth() {
    var calls = 0
    val cache = ColumnXCache { calls++; it * 1.5f }
    for (c in 0..999) cache.x(c)
    for (c in 999 downTo 0) assertEquals(c * 1.5f, cache.x(c), 0f)
    assertEquals(1000, calls)
  }
}
