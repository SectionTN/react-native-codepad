package me.sectiontn.codepad.syntax

/**
 * One injected tree with the unit extent of its content; the tree itself keeps the included ranges.
 * A carried tree's own positions lag the edits made before it: `shift` is what to add to reach the document.
 */
class Injected(val language: LoadedLanguage, val tree: Tree, val start: Int, val end: Int, val shift: Int = 0)

/** Edit to snapshot time plus how many injected trees were parsed fresh, reused incrementally or carried without a parse. */
class ParseStats(val latencyMillis: Int, val freshInjections: Int, val reusedInjections: Int, val carriedInjections: Int)

/** An immutable parse result for one document revision. Owns its trees; `injected` is sorted by start. */
class Snapshot(
  val revision: Int,
  val tree: Tree,
  val injected: List<Injected>,
  val languageId: String,
  val stats: ParseStats = ParseStats(0, 0, 0, 0),
  // The published revision `changed` is relative to, -1 after a full parse; `changed` is sorted, coalesced unit pairs.
  val basedOn: Int = -1,
  val changed: IntArray = IntArray(0),
) : AutoCloseable {
  override fun close() {
    tree.close()
    for (i in injected) i.tree.close()
  }
}
