package me.sectiontn.codepad.core

import java.text.BreakIterator

object TextMovement {
  enum class Unit { Char, Word, LineStart, LineEnd, DocStart, DocEnd }

  fun isWordChar(c: Char): Boolean = c == '_' || c in 'a'..'z' || c in 'A'..'Z' || c in '0'..'9'

  fun nextGrapheme(doc: Document, offset: Int): Int {
    if (offset >= doc.length) return doc.length
    val line = doc.lineAt(offset)
    val start = doc.lineStart(line)
    val text = doc.line(line)
    val col = offset - start
    if (col >= text.length) return offset + 1
    val bi = BreakIterator.getCharacterInstance()
    bi.setText(text.toString())
    val next = bi.following(col)
    return start + (if (next == BreakIterator.DONE) text.length else next)
  }

  fun prevGrapheme(doc: Document, offset: Int): Int {
    if (offset <= 0) return 0
    val line = doc.lineAt(offset)
    val start = doc.lineStart(line)
    val col = offset - start
    if (col == 0) return offset - 1
    val bi = BreakIterator.getCharacterInstance()
    bi.setText(doc.line(line).toString())
    val prev = bi.preceding(col)
    return start + (if (prev == BreakIterator.DONE) 0 else prev)
  }

  /** End of the word after [offset]. Skips whitespace first and steps over a line break at a line end. */
  fun nextWordEnd(doc: Document, offset: Int): Int {
    if (offset >= doc.length) return doc.length
    val line = doc.lineAt(offset)
    val start = doc.lineStart(line)
    val text = doc.line(line)
    var col = offset - start
    if (col >= text.length) return offset + 1
    while (col < text.length && text[col].isWhitespace()) col++
    if (col >= text.length) return start + col
    if (isWordChar(text[col])) {
      while (col < text.length && isWordChar(text[col])) col++
      return start + col
    }
    return start + graphemeEnd(text, col)
  }

  fun prevWordStart(doc: Document, offset: Int): Int {
    if (offset <= 0) return 0
    val line = doc.lineAt(offset)
    val start = doc.lineStart(line)
    val text = doc.line(line)
    var col = offset - start
    if (col == 0) return offset - 1
    while (col > 0 && text[col - 1].isWhitespace()) col--
    if (col == 0) return start
    if (isWordChar(text[col - 1])) {
      while (col > 0 && isWordChar(text[col - 1])) col--
      return start + col
    }
    return start + graphemeStart(text, col - 1)
  }

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
    // A punctuation grapheme is its own word. The word BreakIterator would merge "a.b" (UAX 29 MidNumLet).
    val a = graphemeStart(text, col)
    return Range(start + a, start + graphemeEnd(text, a))
  }

  /** Start of the grapheme containing [col]. */
  private fun graphemeStart(text: CharSequence, col: Int): Int {
    if (col <= 0) return 0
    val bi = BreakIterator.getCharacterInstance()
    bi.setText(text.toString())
    return if (bi.isBoundary(col)) col else bi.preceding(col)
  }

  /** End of the grapheme containing [col]. */
  private fun graphemeEnd(text: CharSequence, col: Int): Int {
    val bi = BreakIterator.getCharacterInstance()
    bi.setText(text.toString())
    val next = bi.following(col)
    return if (next == BreakIterator.DONE) text.length else next
  }
}
