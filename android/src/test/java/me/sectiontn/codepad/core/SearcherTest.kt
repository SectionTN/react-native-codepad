package me.sectiontn.codepad.core

import java.util.concurrent.CancellationException
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class SearcherTest {
  private fun <T> withSearch(text: String, query: SearchQuery, block: (Long, Long) -> T): T {
    val core = EditorCore(text)
    core.setSearch(query)
    val snapshot = core.textSnapshot()
    val search = core.compiledSearch()
    try {
      return block(snapshot, search)
    } finally {
      Searcher.release(search)
      Searcher.releaseText(snapshot)
      core.close()
    }
  }

  // A limit hit after a match ends the scan as limited instead of reading as the end of the text.
  @Test
  fun aLimitAfterAMatchEndsTheScanAsLimited() {
    val text = "aa\n" + "a".repeat(40) + "b\naaa"
    val result = withSearch(text, SearchQuery("(a+)+$", regex = true)) { snapshot, search -> Searcher.find(snapshot, search) }
    assertArrayEquals(intArrayOf(0, 2), result.matches)
    assertTrue(result.limited)
  }

  // Text with a lone surrogate skips the fast path: the unit splits the text instead of being read as a character.
  @Test
  fun aLoneSurrogateSplitsTheText() {
    val literal = withSearch("x\uD800x", SearchQuery("x")) { snapshot, search -> Searcher.find(snapshot, search) }
    assertArrayEquals(intArrayOf(0, 1, 2, 3), literal.matches)
    val regex = withSearch("x\uD800x", SearchQuery("x.", regex = true)) { snapshot, search -> Searcher.find(snapshot, search) }
    assertArrayEquals(intArrayOf(), regex.matches)
  }

  // A costly pattern that never matches still reaches the cancel check while it scans.
  @Test
  fun cancelLandsInsideAScanWithNoMatch() {
    val text = List(40) { "a".repeat(18) + "b" }.joinToString("\n")
    withSearch(text, SearchQuery("(a+)+$", regex = true)) { snapshot, search ->
      var asked = 0
      assertThrows(CancellationException::class.java) {
        Searcher.find(snapshot, search) {
          asked++
          asked > 1
        }
      }
    }
  }
}
