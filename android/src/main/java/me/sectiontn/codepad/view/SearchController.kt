package me.sectiontn.codepad.view

import java.util.concurrent.CancellationException
import java.util.concurrent.Executor
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import me.sectiontn.codepad.core.Change
import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.core.SearchQuery
import me.sectiontn.codepad.core.SearchSession
import me.sectiontn.codepad.core.Searcher

/**
 * Computes the matches on a worker over a text snapshot and hands them to the core on the main thread.
 * Every member runs on the main thread; the painted matches shift through edits until fresh ones land.
 */
class SearchController(
  private val core: EditorCore,
  private val postToMain: (Runnable) -> Unit,
  private val executor: Executor = Executors.newSingleThreadExecutor { r -> Thread(r, "codepad-search").apply { isDaemon = true } },
) : AutoCloseable {
  private class Job(val generation: Int) {
    @Volatile
    var cancelled = false
  }

  var onResult: ((count: Int, millis: Long) -> Unit)? = null
  val active: Boolean get() = core.search != null

  private var generation = 0
  private var running: Job? = null
  private var displayed: IntArray = SearchSession.EMPTY
  private val continuations = ArrayList<() -> Unit>()
  private var closed = false

  /** Throws IllegalArgumentException for an invalid regex and clears the search; null clears it too. */
  fun setQuery(query: SearchQuery?) {
    cancelRunning()
    displayed = SearchSession.EMPTY
    if (query == null) {
      core.clearSearch()
      runContinuations()
      return
    }
    core.setSearch(query)
    schedule()
  }

  fun onChange(change: Change) {
    if (!active) return
    displayed = SearchSession.mapThrough(displayed, change)
    schedule()
  }

  /** Runs [block] now when nothing is stale, else once the next accepted result lands. */
  fun whenFresh(block: () -> Unit) {
    if (core.searchStale) continuations.add(block) else block()
  }

  fun matchesForPaint(): IntArray = displayed

  override fun close() {
    closed = true
    cancelRunning()
    continuations.clear()
    (executor as? ExecutorService)?.shutdownNow()
  }

  private fun cancelRunning() {
    running?.cancelled = true
    running = null
  }

  private fun schedule() {
    cancelRunning()
    val query = core.search?.query ?: return
    val job = Job(++generation)
    running = job
    executor.execute {
      val (text, revision) = core.read { core.document.text() to core.document.revision }
      val started = System.nanoTime()
      val result = try {
        Searcher.find(text, query) { job.cancelled }
      } catch (e: CancellationException) {
        return@execute
      }
      val millis = (System.nanoTime() - started) / 1_000_000
      postToMain(Runnable { deliver(job, revision, result, millis) })
    }
  }

  private fun deliver(job: Job, revision: Int, result: IntArray, millis: Long) {
    if (closed || job.generation != generation || !core.acceptMatches(revision, result)) return
    running = null
    displayed = result
    onResult?.invoke(result.size / 2, millis)
    runContinuations()
  }

  private fun runContinuations() {
    if (continuations.isEmpty()) return
    val pending = ArrayList(continuations)
    continuations.clear()
    for (block in pending) block()
  }
}
