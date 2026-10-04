package me.sectiontn.codepad.syntax

import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import me.sectiontn.codepad.core.Change
import me.sectiontn.codepad.core.Document

/**
 * One serial thread per editor owns the parser, the UTF-16 mirror and the live tree. Edits arrive in
 * order, each reparse is incremental, and every completed parse publishes an immutable snapshot.
 */
class SyntaxEngine(
  private val postToMain: (Runnable) -> Unit,
  private val onSnapshot: (Snapshot) -> Unit,
) : AutoCloseable {
  class EditPoints(val start: Point, val oldEnd: Point, val newEnd: Point)

  private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "codepad-syntax").apply { isDaemon = true } }
  private val pending = AtomicInteger(0)
  private val cancel = CancelFlag()
  private var budgetMicros = 50_000L

  // Syntax thread only from here on.
  private val mirror = Mirror()
  private val parser = Parser()
  private var language: LoadedLanguage? = null
  private var tree: Tree? = null
  private var revision = 0
  private var closed = false

  fun setLanguage(id: String?) = submit {
    language = id?.let { LanguageRegistry.resolve(it) }
    tree?.close()
    tree = null
    parser.reset()
    language?.let { parser.setLanguage(it.pointer) }
    reparse()
  }

  fun setText(text: String, revision: Int) = submit {
    mirror.setText(text)
    this.revision = revision
    tree?.close()
    tree = null
    parser.reset()
    reparse()
  }

  fun edit(change: Change, points: EditPoints) {
    pending.incrementAndGet()
    cancel.set(true)
    executor.execute {
      if (closed) return@execute
      mirror.replace(change.start, change.end, change.inserted)
      revision = change.revision
      tree?.edit(InputEdit(change.start, change.end, change.newEnd, points.start, points.oldEnd, points.newEnd))
      if (pending.decrementAndGet() == 0) {
        cancel.set(false)
        reparse()
      }
    }
  }

  override fun close() {
    executor.execute {
      closed = true
      tree?.close()
      tree = null
      parser.close()
      mirror.close()
      cancel.close()
    }
    executor.shutdown()
  }

  private fun submit(block: () -> Unit) {
    pending.incrementAndGet()
    cancel.set(true)
    executor.execute {
      if (closed) return@execute
      if (pending.decrementAndGet() == 0) cancel.set(false)
      block()
    }
  }

  private fun reparse() {
    val lang = language ?: return
    if (pending.get() > 0) return
    val result = parser.parse(tree, mirror, cancel, budgetMicros)
    if (result == null) {
      if (cancel.isSet) {
        parser.reset()
        return
      }
      executor.execute { if (!closed) reparse() }
      return
    }
    tree?.close()
    tree = result
    val snapshot = Snapshot(revision, result.copy(), injections(lang, result))
    postToMain(Runnable { onSnapshot(snapshot) })
  }

  private fun injections(lang: LoadedLanguage, host: Tree): List<Injected> {
    val compiled = lang.injections ?: return emptyList()
    val read: (TSNodeRef) -> String = { n -> mirror.text(n.startUnit, n.endUnit) }
    val contentIndex = compiled.captureIndex["injection.content"] ?: return emptyList()
    val languageIndex = compiled.captureIndex["injection.language"]
    val groups = LinkedHashMap<String, MutableList<IntArray>>()
    val combined = HashSet<String>()
    QueryCursor().use { cursor ->
      cursor.exec(compiled.query, host.rootNode())
      val capture = Capture()
      val handled = HashSet<Int>()
      while (cursor.nextCapture(capture)) {
        if (!handled.add(capture.matchId)) continue
        val all = ArrayList<CaptureNode>(cursor.matchCaptureCount)
        for (i in 0 until cursor.matchCaptureCount) {
          val c = Capture()
          cursor.matchCapture(i, c)
          all.add(CaptureNode(c.captureIndex, c.node))
        }
        if (!compiled.evaluator.matches(capture.patternIndex, all, read)) {
          cursor.removeMatch(capture.matchId)
          continue
        }
        val settings = compiled.evaluator.settings(capture.patternIndex)
        val name = settings["injection.language"]
          ?: all.firstOrNull { it.captureIndex == languageIndex }?.let { read(it.node) }
          ?: continue
        val target = LanguageRegistry.resolveInjection(name) ?: continue
        if (settings.containsKey("injection.combined")) combined.add(target.id)
        for (c in all) {
          if (c.captureIndex != contentIndex) continue
          val n = c.node
          val sp = n.startPoint
          val ep = n.endPoint
          groups.getOrPut(target.id) { ArrayList() }.add(intArrayOf(n.startUnit, n.endUnit, sp.row, sp.column, ep.row, ep.column))
        }
      }
    }
    val out = ArrayList<Injected>()
    for ((id, ranges) in groups) {
      val target = LanguageRegistry.resolve(id) ?: continue
      Parser().use { sub ->
        if (!sub.setLanguage(target.pointer)) return@use
        val batches = if (id in combined) listOf(ranges) else ranges.map { listOf(it) }
        for (batch in batches) {
          val flat = IntArray(batch.size * 6)
          for ((i, r) in batch.withIndex()) System.arraycopy(r, 0, flat, i * 6, 6)
          sub.setIncludedRanges(flat)
          val t = sub.parse(null, mirror, cancel, 0) ?: break
          out.add(Injected(target, t, flat))
        }
      }
    }
    return out
  }

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
