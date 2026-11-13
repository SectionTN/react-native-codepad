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
    c.shift(0, 2, 1)
    assertNull(c[0])
    assertEquals("l3", c[4])
    assertEquals("l5", c[6])
    assertEquals(3, c.size)
  }

  // The draw lists the cache for the frame call before it lays anything out. A listing that refreshed the order
  // would evict the lines just drawn instead of the stale ones.
  @Test
  fun forEachEntryLeavesTheEvictionOrder() {
    val c = LayoutCache<String>(8)
    for (i in 0 until 8) c.put(i, "l$i")
    c[0]
    val seen = HashMap<Int, String>()
    c.forEachEntry { line, value -> seen[line] = value }
    assertEquals((0 until 8).associateWith { "l$it" }, seen)
    c.put(8, "l8")
    c.put(9, "l9")
    assertNull(c[1])
    assertNull(c[2])
    assertEquals("l0", c[0])
    assertEquals("l3", c[3])
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
}
