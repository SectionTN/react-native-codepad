package me.sectiontn.codepad.layout

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LayoutCacheTest {
  @Test
  fun evictsTheLeastRecentlyUsedEntry() {
    val c = LayoutCache<String>(2)
    c.put(0, "a")
    c.put(1, "b")
    c[0]
    c.put(2, "c")
    assertNull(c[1])
    assertEquals("a", c[0])
    assertEquals("c", c[2])
    assertEquals(2, c.size)
  }

  @Test
  fun shiftDropsChangedLinesAndMovesTheRest() {
    val c = LayoutCache<String>(10)
    for (i in 0 until 6) c.put(i, "l$i")
    c.shift(2, 1, 3)
    assertEquals("l1", c[1])
    assertNull(c[2])
    assertNull(c[3])
    assertNull(c[4])
    assertEquals("l3", c[5])
    assertEquals("l5", c[7])
    assertEquals(5, c.size)
  }

  @Test
  fun shiftHandlesAnInsertionBeforeALine() {
    val c = LayoutCache<String>(10)
    c.put(0, "a")
    c.put(1, "b")
    c.shift(1, 0, 2)
    assertEquals("a", c[0])
    assertNull(c[1])
    assertEquals("b", c[3])
    c.shift(0, 3, 1)
    assertEquals("b", c[1])
    assertEquals(1, c.size)
  }

  @Test
  fun capacityChangeTrims() {
    val c = LayoutCache<String>(4)
    for (i in 0 until 4) c.put(i, "x")
    c.capacity = 2
    assertEquals(2, c.size)
    assertNull(c[0])
    assertEquals("x", c[3])
  }

  @Test
  fun removeIfDropsMatches() {
    val c = LayoutCache<String>(4)
    c.put(0, "keep")
    c.put(1, "drop")
    c.removeIf { _, v -> v == "drop" }
    assertEquals(1, c.size)
    assertEquals("keep", c[0])
    c.clear()
    assertEquals(0, c.size)
  }
}
