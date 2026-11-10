package me.sectiontn.codepad.core

/** The app's decorations in current document coordinates. [version] moves on every change. */
class DecorationSet {
  var items: List<Decoration> = emptyList()
    private set
  var version = 0
    private set

  fun replace(items: List<Decoration>) {
    this.items = items
    version++
  }

  fun clear() {
    if (items.isNotEmpty()) replace(emptyList())
  }

  fun map(span: EditSpan) {
    if (items.isEmpty()) return
    replace(items.mapNotNull { mapOne(it, span) })
  }

  /** Total gap rows per line, lines with a gap only. */
  fun gapRows(): Map<Int, Int> {
    val out = HashMap<Int, Int>()
    for (d in items) if (d is Gap) out[d.line] = (out[d.line] ?: 0) + d.rows
    return out
  }

  companion object {
    fun mapOne(d: Decoration, span: EditSpan): Decoration? = when (d) {
      is Underline -> span.mapUnderline(d)
      is Gap -> span.mapLine(d.line).takeIf { it >= 0 }?.let { d.copy(line = it) }
      is LineBackground -> span.mapLine(d.line).takeIf { it >= 0 }?.let { d.copy(line = it) }
    }
  }
}
