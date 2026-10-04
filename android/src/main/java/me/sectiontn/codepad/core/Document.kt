package me.sectiontn.codepad.core

class Document(initialText: String = "") {
  private val lines = ArrayList<StringBuilder>()
  private var lineStarts = IntArray(64)
  private var cleanLines = 0

  var length: Int = 0
    private set
  var revision: Int = 0
    private set

  init {
    val text = normalizeNewlines(initialText)
    var from = 0
    while (true) {
      val nl = text.indexOf('\n', from)
      if (nl < 0) {
        lines.add(StringBuilder(text.substring(from)))
        break
      }
      lines.add(StringBuilder(text.substring(from, nl)))
      from = nl + 1
    }
    length = text.length
  }

  val lineCount: Int get() = lines.size

  fun line(index: Int): CharSequence = if (index in 0 until lines.size) lines[index] else ""

  fun lineLength(index: Int): Int = if (index in 0 until lines.size) lines[index].length else 0

  /** Start offset of line [index]. index == lineCount yields length + 1 so the prefix sums stay uniform. */
  fun lineStart(index: Int): Int {
    val i = index.coerceIn(0, lines.size)
    ensureStarts(i)
    return lineStarts[i]
  }

  fun lineEnd(index: Int): Int = lineStart(index) + lineLength(index)

  fun lineAt(offset: Int): Int {
    val o = offset.coerceIn(0, length)
    ensureStarts(lines.size - 1)
    var lo = 0
    var hi = lines.size - 1
    while (lo < hi) {
      val mid = (lo + hi + 1) ushr 1
      if (lineStarts[mid] <= o) lo = mid else hi = mid - 1
    }
    return lo
  }

  fun offsetToPosition(offset: Int): Position {
    val o = offset.coerceIn(0, length)
    val line = lineAt(o)
    return Position(line, o - lineStart(line))
  }

  fun positionToOffset(line: Int, column: Int): Int {
    val l = line.coerceIn(0, lines.size - 1)
    val c = column.coerceIn(0, lines[l].length)
    return lineStart(l) + c
  }

  /** Character at [offset]. Line breaks read as '\n'. The caller guarantees 0 <= offset < length. */
  fun charAt(offset: Int): Char {
    val line = lineAt(offset)
    val col = offset - lineStart(line)
    val sb = lines[line]
    return if (col < sb.length) sb[col] else '\n'
  }

  fun text(): String = text(0, length)

  fun text(start: Int, end: Int): String {
    val (s, e) = clamp(start, end)
    if (s == e) return ""
    val sl = lineAt(s)
    val el = lineAt(e)
    val sb = StringBuilder(e - s)
    for (line in sl..el) {
      val from = if (line == sl) s - lineStart(sl) else 0
      val to = if (line == el) e - lineStart(el) else lines[line].length
      sb.append(lines[line], from, to)
      if (line != el) sb.append('\n')
    }
    return sb.toString()
  }

  fun replace(start: Int, end: Int, text: String): Change {
    val (s, e) = clamp(start, end)
    val inserted = normalizeNewlines(text)
    val removed = text(s, e)
    val sl = lineAt(s)
    val sc = s - lineStart(sl)
    val el = lineAt(e)
    val ec = e - lineStart(el)
    val prefix = lines[sl].substring(0, sc)
    val suffix = lines[el].substring(ec)
    val parts = inserted.split('\n')
    val fresh = ArrayList<StringBuilder>(parts.size)
    if (parts.size == 1) {
      fresh.add(StringBuilder(prefix).append(parts[0]).append(suffix))
    } else {
      fresh.add(StringBuilder(prefix).append(parts[0]))
      for (i in 1 until parts.size - 1) fresh.add(StringBuilder(parts[i]))
      fresh.add(StringBuilder(parts[parts.size - 1]).append(suffix))
    }
    lines.subList(sl, el + 1).clear()
    lines.addAll(sl, fresh)
    length += inserted.length - removed.length
    // The start of the first touched line did not move, so its cached start stays valid.
    cleanLines = minOf(cleanLines, sl + 1)
    revision++
    return Change(s, removed, inserted, revision)
  }

  private fun clamp(start: Int, end: Int): Pair<Int, Int> {
    val s = start.coerceIn(0, length)
    val e = end.coerceIn(0, length)
    return if (s <= e) s to e else e to s
  }

  private fun ensureStarts(upTo: Int) {
    if (lineStarts.size < lines.size + 1) {
      lineStarts = lineStarts.copyOf(maxOf(lines.size + 1, lineStarts.size * 2))
    }
    if (cleanLines == 0) {
      lineStarts[0] = 0
      cleanLines = 1
    }
    while (cleanLines <= upTo) {
      val i = cleanLines
      lineStarts[i] = lineStarts[i - 1] + lines[i - 1].length + 1
      cleanLines++
    }
  }

  companion object {
    fun normalizeNewlines(text: String): String =
      if (text.indexOf('\r') < 0) text else text.replace("\r\n", "\n").replace('\r', '\n')
  }
}
