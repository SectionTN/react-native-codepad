package me.sectiontn.codepad.core

object BracketMatcher {
  private const val LIMIT = 100_000

  fun partnerOf(c: Char): Char? = when (c) {
    '(' -> ')'
    '[' -> ']'
    '{' -> '}'
    ')' -> '('
    ']' -> '['
    '}' -> '{'
    else -> null
  }

  /**
   * Returns [bracketAtCaret, partner] or null. The bracket after the caret is tried first, then the one
   * before it. [skip] excludes offsets inside strings and comments once a syntax snapshot exists.
   */
  fun match(doc: Document, caret: Int, skip: ((Int) -> Boolean)?): IntArray? {
    val len = doc.length
    val at = when {
      caret < len && partnerOf(doc.charAt(caret)) != null && skip?.invoke(caret) != true -> caret
      caret > 0 && partnerOf(doc.charAt(caret - 1)) != null && skip?.invoke(caret - 1) != true -> caret - 1
      else -> return null
    }
    val c = doc.charAt(at)
    val partner = partnerOf(c) ?: return null
    val step = if (c == '(' || c == '[' || c == '{') 1 else -1
    var depth = 0
    var i = at
    var steps = 0
    while (i in 0 until len && steps < LIMIT) {
      val ch = doc.charAt(i)
      if (skip?.invoke(i) != true) {
        if (ch == c) depth++
        else if (ch == partner) {
          depth--
          if (depth == 0) return intArrayOf(at, i)
        }
      }
      i += step
      steps++
    }
    return null
  }
}
