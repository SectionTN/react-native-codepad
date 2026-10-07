package me.sectiontn.codepad.view

import java.util.concurrent.Executor
import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.core.SearchQuery
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class SearchControllerTest {
  private class ManualExecutor : Executor {
    private val queue = ArrayDeque<Runnable>()
    override fun execute(command: Runnable) {
      queue.add(command)
    }
    fun runAll() {
      while (queue.isNotEmpty()) queue.removeFirst().run()
    }
  }

  private val executor = ManualExecutor()
  private val main = ArrayDeque<Runnable>()
  private val core = EditorCore("ab ab ab")
  private val controller = SearchController(core, { main.add(it) }, executor)

  private fun drainMain() {
    while (main.isNotEmpty()) main.removeFirst().run()
  }

  private fun settle() {
    executor.runAll()
    drainMain()
  }

  @Test
  fun setQueryAcceptsMatchesForTheCurrentRevision() {
    controller.setQuery(SearchQuery("ab"))
    assertTrue(core.searchStale)
    settle()
    assertFalse(core.searchStale)
    assertArrayEquals(intArrayOf(0, 2, 3, 5, 6, 8), controller.matchesForPaint())
    assertEquals(3, core.matchCount)
  }

  @Test
  fun whenFreshQueuesUntilTheResultLands() {
    controller.setQuery(SearchQuery("ab"))
    var ran = 0
    controller.whenFresh { ran++ }
    assertEquals(0, ran)
    settle()
    assertEquals(1, ran)
  }

  @Test
  fun whenFreshRunsNowWhenNothingIsStale() {
    var ran = 0
    controller.whenFresh { ran++ }
    assertEquals(1, ran)
    controller.setQuery(SearchQuery("ab"))
    settle()
    controller.whenFresh { ran++ }
    assertEquals(2, ran)
  }

  @Test
  fun aStaleResultIsDroppedAndTheContinuationWaits() {
    controller.setQuery(SearchQuery("ab"))
    executor.runAll()
    val change = core.replace(0, 0, "x")
    controller.onChange(change)
    var ran = 0
    controller.whenFresh { ran++ }
    drainMain()
    assertTrue(core.searchStale)
    assertEquals(0, ran)
    settle()
    assertFalse(core.searchStale)
    assertEquals(1, ran)
    assertArrayEquals(intArrayOf(1, 3, 4, 6, 7, 9), controller.matchesForPaint())
  }

  @Test
  fun displayedMatchesShiftThroughAnEdit() {
    controller.setQuery(SearchQuery("ab"))
    settle()
    val change = core.replace(2, 2, "zz")
    controller.onChange(change)
    assertArrayEquals(intArrayOf(0, 2, 5, 7, 8, 10), controller.matchesForPaint())
  }

  @Test
  fun clearingTheQueryDropsEverything() {
    controller.setQuery(SearchQuery("ab"))
    settle()
    controller.setQuery(null)
    assertFalse(controller.active)
    assertEquals(0, controller.matchesForPaint().size)
  }

  @Test
  fun closeSettlesPendingContinuations() {
    controller.setQuery(SearchQuery("ab"))
    var ran = 0
    controller.whenFresh { ran++ }
    controller.close()
    assertEquals(1, ran)
    settle()
    assertEquals(1, ran)
  }

  @Test
  fun anInvalidRegexThrowsAndClears() {
    assertThrows(IllegalArgumentException::class.java) { controller.setQuery(SearchQuery("(", regex = true)) }
    assertFalse(controller.active)
  }
}
