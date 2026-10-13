package me.sectiontn.codepad.core

class Document(initialText: String = "") {
  private val lines = ArrayList<StringBuilder>()
  private var lineStarts = IntArray(0)

  var length: Int = 0
    private set
  var revision: Int = 0
    private set

  init {
    val text = normalizeNewlines(initialText)
    var from = 0
    // Exact capacity and no substring copies: the default builder adds 16 spare chars to every line.
    while (true) {
      val nl = text.indexOf('\n', from)
      if (nl < 0) {
        lines.add(StringBuilder(text.length - from).append(text, from, text.length))
        break
      }
      lines.add(StringBuilder(nl - from).append(text, from, nl))
      from = nl + 1
    }
    length = text.length
    rebuildStarts(0)
  }

  val lineCount: Int get() = lines.size

  fun line(index: Int): CharSequence = if (index in 0 until lines.size) lines[index] else ""

  fun lineLength(index: Int): Int = if (index in 0 until lines.size) lines[index].length else 0

  /** Start offset of line [index]. index == lineCount yields length + 1 so the prefix sums stay uniform. */
  fun lineStart(index: Int): Int = lineStarts[index.coerceIn(0, lines.size)]

  fun lineEnd(index: Int): Int = lineStart(index) + lineLength(index)

  fun lineAt(offset: Int): Int {
    val o = offset.coerceIn(0, length)
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
      // Exact capacity: the default adds 16 spare chars per line, which is a third of a typical line.
      for (i in 1 until parts.size - 1) fresh.add(StringBuilder(parts[i].length).append(parts[i]))
      fresh.add(StringBuilder(parts[parts.size - 1]).append(suffix))
    }
    lines.subList(sl, el + 1).clear()
    lines.addAll(sl, fresh)
    length += inserted.length - removed.length
    // Line sl keeps its start; the rest is rebuilt here, under the writer's lock, so no reader ever mutates the table.
    rebuildStarts(sl + 1)
    revision++
    return Change(s, removed, inserted, revision)
  }

  private fun clamp(start: Int, end: Int): Pair<Int, Int> {
    val s = start.coerceIn(0, length)
    val e = end.coerceIn(0, length)
    return if (s <= e) s to e else e to s
  }

  /** Prefix sums of the line lengths plus their newlines, one entry per line and the sentinel at [lineCount]. */
  private fun rebuildStarts(from: Int) {
    val count = lines.size + 1
    if (lineStarts.size < count) lineStarts = lineStarts.copyOf(maxOf(count, lineStarts.size * 2))
    var i = from
    if (i == 0) {
      lineStarts[0] = 0
      i = 1
    }
    while (i < count) {
      lineStarts[i] = lineStarts[i - 1] + lines[i - 1].length + 1
      i++
    }
  }

  companion object {
    fun normalizeNewlines(text: String): String =
      if (text.indexOf('\r') < 0) text else text.replace("\r\n", "\n").replace('\r', '\n')
  }
}
