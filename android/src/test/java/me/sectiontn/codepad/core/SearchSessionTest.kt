package me.sectiontn.codepad.core

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class SearchSessionTest {
  @Test
  fun mapThroughDropsATouchedMatchAndShiftsTheRest() {
    val change = Change(start = 4, removed = "x", inserted = "yyy", revision = 1)
    assertArrayEquals(intArrayOf(0, 1, 10, 11), SearchSession.mapThrough(intArrayOf(0, 1, 4, 5, 8, 9), change))
  }

  @Test
  fun mapThroughShiftsAnInsertionAtTheMatchStart() {
    val change = Change(start = 4, removed = "", inserted = "zz", revision = 1)
    assertArrayEquals(intArrayOf(0, 1, 6, 7), SearchSession.mapThrough(intArrayOf(0, 1, 4, 5), change))
  }

  @Test
  fun firstEndingAfterFindsTheVisibleWindowStart() {
    assertEquals(1, SearchSession.firstEndingAfter(intArrayOf(0, 2, 3, 5, 6, 8), 2))
  }
}
