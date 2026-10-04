package me.sectiontn.codepad.layout

object GutterMetrics {
  fun digits(lineCount: Int): Int {
    var n = maxOf(lineCount, 1)
    var d = 0
    while (n > 0) {
      d++
      n /= 10
    }
    return d
  }

  /** Digit columns for the last line number plus padding on both sides. */
  fun width(lineCount: Int, digitAdvance: Float, padding: Float): Int =
    Math.round(digits(lineCount) * digitAdvance + 2 * padding)
}
