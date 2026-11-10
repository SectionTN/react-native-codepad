package me.sectiontn.codepad.core

/** One edit in old document coordinates, with the line bounds that decide where line decorations go. */
class EditSpan(
  val start: Int,
  val oldEnd: Int,
  val newLength: Int,
  val startLine: Int,
  val startLineStart: Int,
  val startLineEnd: Int,
  val endLine: Int,
  val endLineEnd: Int,
  val insertedLines: Int,
  val revision: Int,
) {
  private val delta: Int get() = newLength - (oldEnd - start)

  /** The spec's underline table, first matching row wins. Null when the range is gone. */
  fun mapUnderline(u: Underline): Underline? {
    val s = u.start
    val e = u.end
    val a = start
    val b = oldEnd
    val ns: Int
    val ne: Int
    when {
      a == b && a == s -> { ns = s + newLength; ne = e + newLength }
      a == b && a == e -> { ns = s; ne = e }
      b <= s -> { ns = s + delta; ne = e + delta }
      a >= e -> { ns = s; ne = e }
      s <= a && b <= e -> { ns = s; ne = e + delta }
      a <= s && e <= b -> return null
      a < s -> { ns = a + newLength; ne = e + delta }
      else -> { ns = s; ne = a }
    }
    return if (ns < ne) u.copy(start = ns, end = ne) else null
  }

  /** The line [line] ends up on, or -1 when the edit removed it. */
  fun mapLine(line: Int): Int {
    if (line < startLine) return line
    if (line > endLine) return line + insertedLines - (endLine - startLine)
    // Lines strictly inside the span end inside the removed text, so oldEnd stands in for their end.
    val x = when (line) {
      endLine -> endLineEnd
      startLine -> startLineEnd
      else -> oldEnd
    }
    if (x <= start) return line
    if (x > oldEnd) return startLine + insertedLines
    val gone = line != startLine || (start == startLineStart && oldEnd > x)
    return if (gone) -1 else startLine
  }

  companion object {
    /** Built right after the document took [change], so text outside the change still reads as before it. */
    fun of(change: Change, doc: Document): EditSpan {
      val a = change.start
      val n = change.inserted.length
      val startLine = doc.lineAt(a)
      val after = a + n
      val endLineEnd = change.end + (doc.lineEnd(doc.lineAt(after)) - after)
      val firstBreak = change.removed.indexOf('\n')
      return EditSpan(
        start = a,
        oldEnd = change.end,
        newLength = n,
        startLine = startLine,
        startLineStart = doc.lineStart(startLine),
        startLineEnd = if (firstBreak < 0) endLineEnd else a + firstBreak,
        endLine = startLine + change.removed.count { it == '\n' },
        endLineEnd = endLineEnd,
        insertedLines = change.inserted.count { it == '\n' },
        revision = change.revision,
      )
    }
  }
}
