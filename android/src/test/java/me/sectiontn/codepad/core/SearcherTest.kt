package me.sectiontn.codepad.core

import java.util.concurrent.CancellationException
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SearcherTest {
  @Test
  fun packsMatchesAsStartEndPairs() {
    assertArrayEquals(intArrayOf(0, 2, 3, 5), Searcher.find("ab ab", SearchQuery("ab")))
  }

  @Test
  fun cancellationStopsTheScan() {
    var reads = 0
    val cancel = { reads++ >= 3 }
    assertThrows(CancellationException::class.java) { Searcher.find("ab ab ab ab", SearchQuery("ab"), cancel) }
  }
}
