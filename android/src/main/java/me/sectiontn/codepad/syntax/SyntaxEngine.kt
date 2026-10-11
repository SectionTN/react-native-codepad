package me.sectiontn.codepad.syntax

import java.util.concurrent.ExecutorService
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
  private val budgetMicros: Long = 50_000L,
  private val executor: ExecutorService = Executors.newSingleThreadExecutor { r -> Thread(r, "codepad-syntax").apply { isDaemon = true } },
) : AutoCloseable {
  class EditPoints(val start: Point, val oldEnd: Point, val newEnd: Point)

  /** A kept injected tree: `hulls` are unit pairs over its match's captures, `extent` the content span after offsets. */
  private class Kept(val language: LoadedLanguage, val tree: Tree, val combined: Boolean, val hulls: IntArray, val extent: IntArray) {
    val start: Int get() = extent[0]
    val end: Int get() = extent[1]
    // Pass-local marks: a region met one of the hulls; the tree was replaced by a reparse and closed.
    var hit = false
    var consumed = false
  }
  private class Match(val target: LoadedLanguage, val combined: Boolean, val hullStart: Int, val hullEnd: Int, val ranges6: IntArray, val start: Int, val end: Int)
  private data class MatchKey(val pattern: Int, val start: Int, val end: Int)
  private data class ExtentKey(val id: String, val start: Int, val end: Int)
  private class RangeKey(val id: String, val ranges: IntArray) {
    override fun equals(other: Any?): Boolean = other is RangeKey && other.id == id && other.ranges.contentEquals(ranges)
    override fun hashCode(): Int = 31 * id.hashCode() + ranges.contentHashCode()
  }
  private class Counts(var fresh: Int = 0, var reused: Int = 0, var carried: Int = 0)

  private val pending = AtomicInteger(0)
  private val cancel = CancelFlag()
  // Set by the first call after a snapshot, cleared when the next one posts: the difference is the parse latency.
  private val pendingSince = AtomicLong(0)

  // Syntax thread only from here on.
  private val mirror = Mirror()
  private val parser = Parser()
  private var language: LoadedLanguage? = null
  private var tree: Tree? = null
  // Injected trees of the last pass, edited along with the document so unchanged ranges reparse for free.
  private val kept = ArrayList<Kept>()
  // The host tree of the last completed pass, edited like the live one; its diff against the new tree bounds the pass.
  private var reconciled: Tree? = null
  // New spans of the edits since the last completed pass, shifted like hulls: the diff misses a retyped leaf.
  private var dirty = IntArray(0)
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
      // A parse cut by the budget would resume over the edited mirror and ignore the old tree.
      parser.reset()
      revision = change.revision
      val edit = InputEdit(change.start, change.end, change.newEnd, points.start, points.oldEnd, points.newEnd)
      tree?.edit(edit)
      reconciled?.edit(edit)
      for (k in kept) {
        k.tree.edit(edit)
        shift(k.hulls, change.start, change.end, change.newEnd)
        shift(k.extent, change.start, change.end, change.newEnd)
      }
      shift(dirty, change.start, change.end, change.newEnd)
      dirty += intArrayOf(change.start, change.newEnd)
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
    val snapshot = Snapshot(revision, result.copy(), injected, lang.id, ParseStats(latency, counts.fresh, counts.reused, counts.carried))
    postToMain(Runnable { onSnapshot(snapshot) })
  }

  private fun dropKept() {
    for (k in kept) k.tree.close()
    kept.clear()
    reconciled?.close()
    reconciled = null
    dirty = IntArray(0)
  }

  /** Pairs after the edit move with it, pairs before it stay, pairs meeting it grow over its new span. */
  private fun shift(pairs: IntArray, start: Int, oldEnd: Int, newEnd: Int) {
    val delta = newEnd - oldEnd
    var i = 0
    while (i < pairs.size) {
      val s = pairs[i]
      val e = pairs[i + 1]
      if (s >= oldEnd) {
        pairs[i] = s + delta
        pairs[i + 1] = e + delta
      } else if (e > start) {
        pairs[i] = minOf(s, start)
        pairs[i + 1] = maxOf(e + delta, newEnd)
      }
      i += 2
    }
  }

  /** Region [a, b) meets hull [c, d) when they intersect or touch, so an edit at a hull end counts. */
  private fun meets(a: Int, b: Int, c: Int, d: Int): Boolean = a <= d && b >= c

  private fun metBy(hulls: IntArray, regions: IntArray): Boolean {
    var i = 0
    while (i < hulls.size) {
      var j = 0
      while (j < regions.size) {
        if (meets(regions[j], regions[j + 1], hulls[i], hulls[i + 1])) return true
        j += 2
      }
      i += 2
    }
    return false
  }

  // The whole document before the first completed pass, else tree-sitter's diff plus the edits' own spans.
  private fun regions(host: Tree, length: Int): IntArray {
    val ref = reconciled ?: return intArrayOf(0, length)
    val changed = host.changedRanges(since = ref)
    val out = IntArray(changed.size + dirty.size)
    System.arraycopy(changed, 0, out, 0, changed.size)
    System.arraycopy(dirty, 0, out, changed.size, dirty.size)
    for (i in out.indices) out[i] = out[i].coerceIn(0, length)
    return out
  }

  /** One cursor run over [from, to); matches are deduped across runs by pattern and content extent. */
  private fun collectMatches(lang: LoadedLanguage, cursor: QueryCursor, root: TSNodeRef, from: Int, to: Int, seen: MutableSet<MatchKey>, out: MutableList<Match>) {
    val compiled = lang.injections ?: return
    val contentIndex = compiled.captureIndex["injection.content"] ?: return
    val languageIndex = compiled.captureIndex["injection.language"]
    val read: (TSNodeRef) -> String = { n -> mirror.text(n.startUnit, n.endUnit) }
    cursor.exec(compiled.query, root)
    cursor.setUnitRange(from, to)
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
      val combined = settings.containsKey("injection.combined")
      val offset = compiled.evaluator.offset(capture.patternIndex)
      // The hull spans every captured node, so an edit to a language marker touches the tree.
      var hullStart = Int.MAX_VALUE
      var hullEnd = 0
      for (c in all) {
        hullStart = minOf(hullStart, c.node.startUnit)
        hullEnd = maxOf(hullEnd, c.node.endUnit)
      }
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
        if (!seen.add(MatchKey(capture.patternIndex, start, end))) continue
        out.add(Match(target, combined, hullStart, hullEnd, intArrayOf(start, end, sp.row, startColumn, ep.row, endColumn), start, end))
      }
    }
  }

  /**
   * Reconciles the kept trees against what changed since the last completed pass: the query runs over the changed
   * regions only, trees they meet are reparsed, the rest are carried over. Null when a new edit cancelled the pass.
   */
  private fun injections(lang: LoadedLanguage, host: Tree, counts: Counts): List<Injected>? {
    val compiled = lang.injections
    if (compiled == null || !compiled.captureIndex.containsKey("injection.content")) {
      dropKept()
      return emptyList()
    }
    val length = mirror.length
    val regions = regions(host, length)
    val touched = ArrayList<Kept>()
    val carried = ArrayList<Kept>()
    for (k in kept) {
      k.hit = metBy(k.hulls, regions)
      k.consumed = false
      if (k.hit || k.combined) touched.add(k) else carried.add(k)
    }
    val matches = ArrayList<Match>()
    val root = host.rootNode()
    val seen = HashSet<MatchKey>()
    QueryCursor().use { cursor ->
      var i = 0
      while (i < regions.size) {
        // Widened by one unit so a touched hull, however the edit sits against it, intersects the run.
        collectMatches(lang, cursor, root, maxOf(0, regions[i] - 1), minOf(length, regions[i + 1] + 1), seen, matches)
        i += 2
      }
      // A combined group is re-derived every pass: each member hull is queried so unchanged members are found again.
      for (k in touched) {
        if (!k.combined) continue
        var j = 0
        while (j < k.hulls.size) {
          collectMatches(lang, cursor, root, maxOf(0, k.hulls[j] - 1), minOf(length, k.hulls[j + 1] + 1), seen, matches)
          j += 2
        }
      }
    }
    // A match found again at a carried tree's language and extent keeps the carried tree.
    val carriedKeys = HashSet<ExtentKey>()
    for (k in carried) carriedKeys.add(ExtentKey(k.language.id, k.start, k.end))
    val plain = LinkedHashMap<String, MutableList<Match>>()
    val grouped = LinkedHashMap<String, MutableList<Match>>()
    for (m in matches) {
      if (m.combined) grouped.getOrPut(m.target.id) { ArrayList() }.add(m)
      else if (!carriedKeys.contains(ExtentKey(m.target.id, m.start, m.end))) plain.getOrPut(m.target.id) { ArrayList() }.add(m)
    }
    // Touched trees are indexed by their edited ranges; a plain match with equal ranges reparses against one.
    val index = HashMap<RangeKey, ArrayDeque<Kept>>()
    for (k in touched) if (!k.combined) index.getOrPut(RangeKey(k.language.id, k.tree.includedRanges())) { ArrayDeque() }.addLast(k)
    val out = ArrayList<Injected>()
    val next = ArrayList<Kept>()
    fun cancelled(): List<Injected>? {
      // A new edit cancelled a parse: every tree still valid stays kept for the next pass, nothing is published.
      for (i in out) i.tree.close()
      kept.clear()
      kept.addAll(carried)
      kept.addAll(next)
      for (k in touched) if (!k.consumed) kept.add(k)
      return null
    }
    for ((id, group) in plain) {
      val target = group[0].target
      Parser().use { sub ->
        if (!sub.setLanguage(target.pointer)) return@use
        for (m in group) {
          sub.setIncludedRanges(m.ranges6)
          val old = index[RangeKey(id, m.ranges6)]?.removeFirstOrNull()
          val t = sub.parse(old?.tree, mirror, cancel, 0) ?: return cancelled()
          if (old != null) {
            old.tree.close()
            old.consumed = true
            counts.reused++
          } else {
            counts.fresh++
          }
          out.add(Injected(target, t, m.start, m.end))
          next.add(Kept(target, t.copy(), false, intArrayOf(m.hullStart, m.hullEnd), intArrayOf(m.start, m.end)))
        }
      }
    }
    // A combined group is one tree over every member range; it reparses against its old tree only when the ranges match.
    for ((id, group) in grouped) {
      val target = group[0].target
      group.sortBy { it.start }
      val flat = IntArray(group.size * 6)
      val hulls = IntArray(group.size * 2)
      for ((i, m) in group.withIndex()) {
        System.arraycopy(m.ranges6, 0, flat, i * 6, 6)
        hulls[i * 2] = m.hullStart
        hulls[i * 2 + 1] = m.hullEnd
      }
      val old = touched.firstOrNull { it.combined && !it.consumed && it.language.id == id }
      val same = old != null && old.tree.includedRanges().contentEquals(flat)
      if (old != null && same && !old.hit) {
        // No member met a region and the ranges are unchanged: the group is carried like a plain tree.
        touched.remove(old)
        carried.add(old)
        continue
      }
      Parser().use { sub ->
        if (!sub.setLanguage(target.pointer)) return@use
        sub.setIncludedRanges(flat)
        val t = sub.parse(if (same) old?.tree else null, mirror, cancel, 0) ?: return cancelled()
        if (old != null) {
          old.tree.close()
          old.consumed = true
        }
        if (same) counts.reused++ else counts.fresh++
        val extent = intArrayOf(group[0].start, group[group.size - 1].end)
        out.add(Injected(target, t, extent[0], extent[1]))
        next.add(Kept(target, t.copy(), true, hulls, extent))
      }
    }
    for (k in touched) if (!k.consumed) k.tree.close()
    kept.clear()
    kept.addAll(carried)
    kept.addAll(next)
    kept.sortBy { it.start }
    reconciled?.close()
    reconciled = host.copy()
    dirty = IntArray(0)
    counts.carried = carried.size
    val result = ArrayList<Injected>(carried.size + out.size)
    for (k in carried) result.add(Injected(k.language, k.tree.copy(), k.start, k.end))
    result.addAll(out)
    result.sortBy { it.start }
    return result
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
