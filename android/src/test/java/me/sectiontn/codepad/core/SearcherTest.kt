package me.sectiontn.codepad.core

import java.util.concurrent.CancellationException
import org.junit.Assert.assertThrows
import org.junit.Test

class SearcherTest {
  @Test
  fun cancellationStopsTheScan() {
    // One match longer than the read budget, so the throw has to come from inside the matcher.
    var reads = 0
    val cancel = { reads++ >= 3 }
    assertThrows(CancellationException::class.java) {
      Searcher.find("a".repeat(1000), SearchQuery("a+", regex = true), cancel)
    }
  }
}
