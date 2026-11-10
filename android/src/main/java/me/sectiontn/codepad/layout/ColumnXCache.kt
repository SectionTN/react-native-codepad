package me.sectiontn.codepad.layout

/** Remembers [measure] per column for one immutable line layout. Sized by the columns asked, not the line length. */
class ColumnXCache(private val measure: (Int) -> Float) {
  private var keys = NO_KEYS
  private var values = NO_VALUES
  private var size = 0

  /** [column] must not be negative. */
  fun x(column: Int): Float {
    if (keys.isNotEmpty()) {
      var i = slot(column, keys.size)
      while (true) {
        val k = keys[i]
        if (k == column) return values[i]
        if (k == EMPTY) break
        i = (i + 1) and (keys.size - 1)
      }
    }
    val x = measure(column)
    if ((size + 1) * 2 > keys.size) grow()
    put(column, x)
    return x
  }

  private fun put(column: Int, x: Float) {
    var i = slot(column, keys.size)
    while (keys[i] != EMPTY) i = (i + 1) and (keys.size - 1)
    keys[i] = column
    values[i] = x
    size++
  }

  private fun grow() {
    val oldKeys = keys
    val oldValues = values
    val capacity = maxOf(8, oldKeys.size * 2)
    keys = IntArray(capacity) { EMPTY }
    values = FloatArray(capacity)
    size = 0
    for (i in oldKeys.indices) if (oldKeys[i] != EMPTY) put(oldKeys[i], oldValues[i])
  }

  private fun slot(column: Int, capacity: Int): Int = (column * GOLDEN) ushr (32 - Integer.numberOfTrailingZeros(capacity))

  private companion object {
    const val EMPTY = -1
    const val GOLDEN = -0x61c88647
    val NO_KEYS = IntArray(0)
    val NO_VALUES = FloatArray(0)
  }
}
