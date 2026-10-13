package me.sectiontn.codepad.syntax

import me.sectiontn.codepad.core.Document

/**
 * The runs of visible lines prepare must re-query, flat inclusive [lo, hi, ...]: a line with no entry or one older than
 * the applied snapshot, or, with `changed` given, one a changed region meets; without `changed` every line not at `revision`.
 */
internal fun dirtyRuns(first: Int, last: Int, revision: Int, applied: Int, changed: IntArray?, doc: Document, entryRevision: (Int) -> Int?): IntArray {
  val out = ArrayList<Int>()
  var r = 0
  for (line in first..last) {
    val entry = entryRevision(line)
    val dirty = when {
      entry == null -> true
      entry == revision -> false
      changed == null || entry < applied -> true
      else -> {
        val start = doc.lineStart(line)
        while (r + 1 < changed.size && maxOf(changed[r], changed[r + 1] - 1) < start) r += 2
        r + 1 < changed.size && changed[r] <= doc.lineEnd(line)
      }
    }
    if (!dirty) continue
    if (out.isNotEmpty() && out[out.size - 1] == line - 1) out[out.size - 1] = line else {
      out.add(line)
      out.add(line)
    }
  }
  return out.toIntArray()
}
