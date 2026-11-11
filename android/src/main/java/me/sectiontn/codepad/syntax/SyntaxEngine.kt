package me.sectiontn.codepad.syntax

import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import me.sectiontn.codepad.core.Change
import me.sectiontn.codepad.core.Document

/** A tree-sitter point in UTF-16 units. */
class Point(val row: Int, val column: Int)

/**
 * One parse engine per editor, run by the shared C++ core on this object's single thread. Edits arrive in
 * order, each reparse is incremental, and every completed parse publishes an immutable snapshot.
 */
class SyntaxEngine(
  postToMain: (Runnable) -> Unit,
  onSnapshot: (Snapshot) -> Unit,
  budgetMicros: Long = 50_000L,
  private val executor: ExecutorService = Executors.newSingleThreadExecutor { r -> Thread(r, "codepad-syntax").apply { isDaemon = true } },
) : AutoCloseable {
  class EditPoints(val start: Point, val oldEnd: Point, val newEnd: Point)

  private lateinit var handle: EngineHandle

  init {
    val host = CoreHost(executor, postToMain) { pointer ->
      // The final post after close carries no snapshot: the worker is free to stop.
      if (pointer == 0L) executor.shutdown() else onSnapshot(Snapshot(pointer, handle))
    }
    handle = EngineHandle(CoreNative.engineNew(host, budgetMicros))
  }

  fun setLanguage(id: String?) {
    val language = id?.let { LanguageRegistry.resolve(it) }
    val engine = handle.pointer
    if (engine != 0L) CoreNative.engineSetLanguage(engine, language?.handle ?: 0L)
  }

  fun setText(text: String, revision: Int) {
    val engine = handle.pointer
    if (engine != 0L) CoreNative.engineSetText(engine, text, revision)
  }

  fun edit(change: Change, points: EditPoints) {
    val engine = handle.pointer
    if (engine == 0L) return
    val p = intArrayOf(points.start.row, points.start.column, points.oldEnd.row, points.oldEnd.column, points.newEnd.row, points.newEnd.column)
    CoreNative.engineEdit(engine, change.start, change.removed.length, change.inserted, change.revision, p)
  }

  /** Frees a snapshot the view replaced on the worker, so the main thread never frees the trees. */
  fun release(snapshot: Snapshot) = snapshot.close()

  override fun close() = handle.close()

  companion object {
    /** Call right after a change was applied: the start is unchanged, the old end comes from the removed text. */
    fun pointsFor(doc: Document, change: Change): EditPoints {
      val start = doc.offsetToPosition(change.start)
      val newEnd = doc.offsetToPosition(change.newEnd)
      val removed = change.removed
      val lastBreak = removed.lastIndexOf('\n')
      val oldEnd = if (lastBreak < 0) Point(start.line, start.column + removed.length)
        else Point(start.line + removed.count { it == '\n' }, removed.length - lastBreak - 1)
      return EditPoints(Point(start.line, start.column), oldEnd, Point(newEnd.line, newEnd.column))
    }
  }
}
