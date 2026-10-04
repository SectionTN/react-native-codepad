package me.sectiontn.codepad.syntax

class Injected(val language: LoadedLanguage, val tree: Tree, val ranges: IntArray)

/** An immutable parse result for one document revision. Owns its trees. Close it on the main thread when replaced. */
class Snapshot(val revision: Int, val tree: Tree, val injected: List<Injected>) : AutoCloseable {
  override fun close() {
    tree.close()
    for (i in injected) i.tree.close()
  }
}
