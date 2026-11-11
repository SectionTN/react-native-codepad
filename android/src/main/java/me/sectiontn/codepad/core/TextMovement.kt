package me.sectiontn.codepad.core

import me.sectiontn.codepad.syntax.CoreNative

object TextMovement {
  /** Ordinals match CP_MOVE_*. */
  enum class Unit { Char, Word, LineStart, LineEnd, DocStart, DocEnd }

  fun isWordChar(c: Char): Boolean = c == '_' || c in 'a'..'z' || c in 'A'..'Z' || c in '0'..'9'

  fun nextGrapheme(doc: Document, offset: Int): Int = CoreNative.docGrapheme(doc.handle, offset, true)

  fun prevGrapheme(doc: Document, offset: Int): Int = CoreNative.docGrapheme(doc.handle, offset, false)

  /** Double tap target: an identifier run, a whitespace run, or a single punctuation grapheme. */
  fun wordRangeAt(doc: Document, offset: Int): Range {
    val o = offset.coerceIn(0, doc.length)
    val line = doc.lineAt(o)
    val start = doc.lineStart(line)
    val text = doc.line(line)
    if (text.isEmpty()) return Range(start, start)
    var col = (o - start).coerceIn(0, text.length)
    if (col == text.length) col--
    val c = text[col]
    val cls: ((Char) -> Boolean)? = when {
      isWordChar(c) -> { ch -> isWordChar(ch) }
      c.isWhitespace() -> { ch -> ch.isWhitespace() }
      else -> null
    }
    if (cls != null) {
      var a = col
      var b = col + 1
      while (a > 0 && cls(text[a - 1])) a--
      while (b < text.length && cls(text[b])) b++
      return Range(start + a, start + b)
    }
    // A punctuation grapheme is its own word, so "a.b" splits in three.
    val end = nextGrapheme(doc, start + col)
    return Range(prevGrapheme(doc, end), end)
  }
}
