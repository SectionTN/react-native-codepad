package me.sectiontn.codepad.view

import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.syntax.Snapshot

/** The bracket pair at the caret, recomputed only when the document, the caret, the snapshot or the flag changes. */
class BracketHighlight(private val core: EditorCore) {
  var enabled = true

  private var cached: IntArray? = null
  private var keyRevision = -1
  private var keyHead = -1
  private var keySnapshot = -1
  private var keyEnabled = false

  /** A [snapshot] at the document revision skips brackets in strings and comments. Without one every bracket counts. */
  fun pair(snapshot: Snapshot?): IntArray? {
    val revision = core.document.revision
    val head = core.selection.head
    val snapshotRevision = snapshot?.revision ?: -1
    if (revision == keyRevision && head == keyHead && snapshotRevision == keySnapshot && enabled == keyEnabled) return cached
    keyRevision = revision
    keyHead = head
    keySnapshot = snapshotRevision
    keyEnabled = enabled
    cached = if (enabled) core.bracketMatch(snapshot?.pointer ?: 0L) else null
    return cached
  }
}
