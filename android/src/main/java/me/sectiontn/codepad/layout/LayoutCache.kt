package me.sectiontn.codepad.layout

/** Laid out lines for the viewport plus a margin, least recently used first out. Keys are line indexes. */
class LayoutCache<T : Any>(capacity: Int) {
  private val map = LinkedHashMap<Int, T>(32, 0.75f, true)

  var capacity: Int = capacity
    set(value) {
      field = value
      trim()
    }

  val size: Int get() = map.size

  operator fun get(line: Int): T? = map[line]

  fun put(line: Int, value: T) {
    map[line] = value
    trim()
  }

  fun clear() = map.clear()

  /** Lines [first, first + oldCount) changed. Their entries drop and later entries move with their text. */
  fun shift(first: Int, oldCount: Int, newCount: Int) {
    if (map.isEmpty()) return
    val delta = newCount - oldCount
    val kept = ArrayList<Pair<Int, T>>(map.size)
    for ((line, value) in map) {
      when {
        line < first -> kept.add(line to value)
        line < first + oldCount -> {}
        else -> kept.add(line + delta to value)
      }
    }
    map.clear()
    for ((line, value) in kept) map[line] = value
  }

  private fun trim() {
    while (map.size > capacity) map.remove(map.keys.first())
  }
}
