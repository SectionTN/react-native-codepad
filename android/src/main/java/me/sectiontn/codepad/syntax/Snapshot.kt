package me.sectiontn.codepad.syntax

class Injected(val language: LoadedLanguage, val tree: Tree, val ranges: IntArray)

/** Edit to snapshot time plus how many injected trees were parsed fresh or reused incrementally. */
class ParseStats(val latencyMillis: Int, val freshInjections: Int, val reusedInjections: Int)

/** An immutable parse result for one document revision. Owns its trees. Close it on the main thread when replaced. */
class Snapshot(
  val revision: Int,
  val tree: Tree,
  val injected: List<Injected>,
  val stats: ParseStats = ParseStats(0, 0, 0),
) : AutoCloseable {
  override fun close() {
    tree.close()
    for (i in injected) i.tree.close()
  }
}
