package me.sectiontn.codepad.core

import me.sectiontn.codepad.syntax.CoreNative

/**
 * The app's decorations in current document coordinates. The core maps their positions through every edit. This
 * side keeps what the core does not see, the colors and styles, by index.
 */
class DecorationSet internal constructor(private val core: EditorCore) {
  private var payloads: List<Decoration> = emptyList()
  private var cached: List<Decoration> = emptyList()
  private var cachedVersion = Int.MIN_VALUE

  /** Moves on every change. */
  val version: Int get() = CoreNative.editorDecorationsVersion(core.handle())

  val items: List<Decoration>
    get() {
      val current = version
      if (current == cachedVersion) return cached
      val raw = CoreNative.editorDecorations(core.handle())
      val out = ArrayList<Decoration>(raw.size / 4)
      for (i in 0 until raw.size / 4) {
        val a = raw[i * 4 + 1]
        val b = raw[i * 4 + 2]
        when (val d = payloads[raw[i * 4 + 3]]) {
          is Underline -> out.add(d.copy(start = a, end = b))
          is Gap -> out.add(Gap(a, b))
          is LineBackground -> out.add(d.copy(line = a))
        }
      }
      cached = out
      cachedVersion = current
      return out
    }

  /**
   * [revision] is the document revision the items were computed for, below zero for the current one. False when the
   * edits since then are no longer known, which keeps the current set.
   */
  internal fun replace(list: List<Decoration>, revision: Int): Boolean {
    val kept = ArrayList<Decoration>(list.size)
    val raw = IntArray(list.size * 4)
    for (d in list) {
      val i = kept.size * 4
      when (d) {
        is Underline -> {
          // A thickness of zero or less would never advance the wave.
          if (d.thickness <= 0f) continue
          raw[i] = KIND_UNDERLINE
          raw[i + 1] = d.start
          raw[i + 2] = d.end
        }
        is Gap -> {
          raw[i] = KIND_GAP
          raw[i + 1] = d.line
          raw[i + 2] = d.rows
        }
        is LineBackground -> {
          raw[i] = KIND_LINE_BACKGROUND
          raw[i + 1] = d.line
        }
      }
      raw[i + 3] = kept.size
      kept.add(d)
    }
    val accepted = CoreNative.editorSetDecorations(core.handle(), raw.copyOf(kept.size * 4), revision)
    if (accepted) payloads = kept
    return accepted
  }

  /** Total gap rows per line, lines with a gap only. */
  fun gapRows(): Map<Int, Int> {
    val out = HashMap<Int, Int>()
    for (d in items) if (d is Gap) out[d.line] = (out[d.line] ?: 0) + d.rows
    return out
  }

  private companion object {
    // CP_DECORATION_UNDERLINE, CP_DECORATION_GAP, CP_DECORATION_LINE_BACKGROUND.
    const val KIND_UNDERLINE = 0
    const val KIND_GAP = 1
    const val KIND_LINE_BACKGROUND = 2
  }
}
