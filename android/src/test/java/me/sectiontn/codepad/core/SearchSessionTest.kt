package me.sectiontn.codepad.core

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class SearchSessionTest {
  private fun session(vararg pairs: Int) =
    SearchSession(SearchQuery("x"), Searcher.compile(SearchQuery("x"))).apply {
      matches = pairs
      revision = 0
    }

  @Test
  fun indexAtOrAfterIsABinarySearchOnStarts() {
    val s = session(0, 1, 4, 5, 8, 9)
    assertEquals(1, s.indexAtOrAfter(2))
    assertEquals(3, s.indexAtOrAfter(9))
  }

  @Test
  fun nextSkipsTheSelectedMatchAndWraps() {
    val s = session(0, 1, 4, 5)
    assertEquals(1, s.nextIndex(Selection(0, 1)))
    assertEquals(0, s.nextIndex(Selection(4, 5)))
  }

  @Test
  fun previousWraps() {
    val s = session(0, 1, 4, 5)
    assertEquals(1, s.previousIndex(Selection(0, 0)))
  }

  @Test
  fun emptySessionReportsMinusOne() {
    assertEquals(-1, session().nextIndex(Selection(0, 0)))
  }

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
