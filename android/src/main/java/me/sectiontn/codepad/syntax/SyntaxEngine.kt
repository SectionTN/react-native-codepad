package me.sectiontn.codepad.syntax

import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
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

  private class Kept(val language: LoadedLanguage, val tree: Tree)
  private class RangeKey(val id: String, val ranges: IntArray) {
    override fun equals(other: Any?): Boolean = other is RangeKey && other.id == id && other.ranges.contentEquals(ranges)
    override fun hashCode(): Int = 31 * id.hashCode() + ranges.contentHashCode()
  }
  private class Counts(var fresh: Int = 0, var reused: Int = 0)

  private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "codepad-syntax").apply { isDaemon = true } }
  private val pending = AtomicInteger(0)
  private val cancel = CancelFlag()
  private var budgetMicros = 50_000L
  // Set by the first call after a snapshot, cleared when the next one posts: the difference is the parse latency.
  private val pendingSince = AtomicLong(0)

  // Syntax thread only from here on.
  private val mirror = Mirror()
  private val parser = Parser()
  private var language: LoadedLanguage? = null
  private var tree: Tree? = null
  // Injected trees of the last snapshot, edited along with the document so unchanged ranges reparse for free.
  private val kept = ArrayList<Kept>()
  private var revision = 0
  private var closed = false

  fun setLanguage(id: String?) = submit {
    language = id?.let { LanguageRegistry.resolve(it) }
    tree?.close()
    tree = null
    dropKept()
    parser.reset()
    language?.let { parser.setLanguage(it.pointer) }
    reparse()
  }

  fun setText(text: String, revision: Int) = submit {
    mirror.setText(text)
    this.revision = revision
    tree?.close()
    tree = null
    dropKept()
    parser.reset()
    reparse()
  }

  fun edit(change: Change, points: EditPoints) {
    pendingSince.compareAndSet(0L, System.nanoTime())
    pending.incrementAndGet()
    cancel.set(true)
    executor.execute {
      if (closed) return@execute
      mirror.replace(change.start, change.end, change.inserted)
      revision = change.revision
      val edit = InputEdit(change.start, change.end, change.newEnd, points.start, points.oldEnd, points.newEnd)
      tree?.edit(edit)
      for (k in kept) k.tree.edit(edit)
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
      dropKept()
      parser.close()
      mirror.close()
      cancel.close()
    }
    executor.shutdown()
  }

  private fun submit(block: () -> Unit) {
    pendingSince.compareAndSet(0L, System.nanoTime())
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
    val counts = Counts()
    val injected = injections(lang, result, counts) ?: run {
      if (!cancel.isSet) executor.execute { if (!closed) reparse() }
      return
    }
    val since = pendingSince.getAndSet(0L)
    val latency = if (since == 0L) 0 else ((System.nanoTime() - since) / 1_000_000L).toInt()
    val snapshot = Snapshot(revision, result.copy(), injected, lang.id, ParseStats(latency, counts.fresh, counts.reused))
    postToMain(Runnable { onSnapshot(snapshot) })
  }

  private fun dropKept() {
    for (k in kept) k.tree.close()
    kept.clear()
  }

  private fun injections(lang: LoadedLanguage, host: Tree, counts: Counts): List<Injected>? {
    val compiled = lang.injections
    if (compiled == null) {
      dropKept()
      return emptyList()
    }
    val read: (TSNodeRef) -> String = { n -> mirror.text(n.startUnit, n.endUnit) }
    val contentIndex = compiled.captureIndex["injection.content"]
    if (contentIndex == null) {
      dropKept()
      return emptyList()
    }
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
        val offset = compiled.evaluator.offset(capture.patternIndex)
        for (c in all) {
          if (c.captureIndex != contentIndex) continue
          val n = c.node
          val sp = n.startPoint
          val ep = n.endPoint
          var start = n.startUnit
          var end = n.endUnit
          var startColumn = sp.column
          var endColumn = ep.column
          // Column shifts trim delimiters on their own row, which is all nvim uses; row shifts are ignored.
          if (offset != null && offset.captureIndex == c.captureIndex && offset.startRow == 0 && offset.endRow == 0) {
            start += offset.startColumn
            end += offset.endColumn
            startColumn += offset.startColumn
            endColumn += offset.endColumn
          }
          if (start >= end) continue
          groups.getOrPut(target.id) { ArrayList() }.add(intArrayOf(start, end, sp.row, startColumn, ep.row, endColumn))
        }
      }
    }
    // Kept trees are indexed once by their edited ranges; a hit reparses against the old tree.
    val index = HashMap<RangeKey, ArrayDeque<Kept>>()
    for (k in kept) index.getOrPut(RangeKey(k.language.id, k.tree.includedRanges())) { ArrayDeque() }.addLast(k)
    val out = ArrayList<Injected>()
    val next = ArrayList<Kept>()
    for ((id, ranges) in groups) {
      val target = LanguageRegistry.resolve(id) ?: continue
      Parser().use { sub ->
        if (!sub.setLanguage(target.pointer)) return@use
        val batches = if (id in combined) listOf(ranges) else ranges.map { listOf(it) }
        for (batch in batches) {
          val flat = IntArray(batch.size * 6)
          for ((i, r) in batch.withIndex()) System.arraycopy(r, 0, flat, i * 6, 6)
          sub.setIncludedRanges(flat)
          val old = index[RangeKey(id, flat)]?.removeFirstOrNull()
          val t = sub.parse(old?.tree, mirror, cancel, 0)
          if (t == null) {
            // Cancelled by a new edit: the trees parsed so far stay kept for the next pass, nothing is published.
            for (i in out) i.tree.close()
            kept.addAll(next)
            return null
          }
          if (old != null) {
            old.tree.close()
            kept.remove(old)
          }
          if (old != null) counts.reused++ else counts.fresh++
          out.add(Injected(target, t, flat))
          next.add(Kept(target, t.copy()))
        }
      }
    }
    dropKept()
    kept.addAll(next)
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
