package me.sectiontn.codepad.core

object Indenter {
  data class Newline(val text: String, val caretOffset: Int)

  fun unit(settings: EditorSettings): String = if (settings.insertSpaces) " ".repeat(settings.tabSize) else "\t"

  fun leadingWhitespace(line: CharSequence): String {
    var i = 0
    while (i < line.length && (line[i] == ' ' || line[i] == '\t')) i++
    return line.substring(0, i)
  }

  /** Text to insert for Enter replacing [start, end), and where the caret lands relative to the insertion start. */
  fun newline(doc: Document, start: Int, end: Int, settings: EditorSettings): Newline {
    if (!settings.autoIndent) return Newline("\n", 1)
    val line = doc.lineAt(start)
    val text = doc.line(line)
    val col = start - doc.lineStart(line)
    val indent = leadingWhitespace(text).let { if (it.length > col) it.substring(0, col) else it }
    val opener = text.subSequence(0, col).trimEnd().lastOrNull()
    val closer = if (end < doc.length) doc.charAt(end) else null
    val matching = when (opener) {
      '{' -> '}'
      '(' -> ')'
      '[' -> ']'
      else -> return Newline("\n$indent", 1 + indent.length)
    }
    val inner = indent + unit(settings)
    return if (closer == matching) Newline("\n$inner\n$indent", 1 + inner.length) else Newline("\n$inner", 1 + inner.length)
  }

  /** Lines a selection covers. A selection that ends exactly at a line start does not include that line. */
  fun selectedLines(doc: Document, sel: Selection): IntRange {
    val first = doc.lineAt(sel.min)
    var last = doc.lineAt(sel.max)
    if (last > first && sel.max == doc.lineStart(last)) last--
    return first..last
  }

  /** Characters to drop from the line start for one outdent: a tab, or up to tabSize spaces. */
  fun outdentCount(line: CharSequence, settings: EditorSettings): Int {
    if (line.isEmpty()) return 0
    if (line[0] == '\t') return 1
    var n = 0
    while (n < line.length && n < settings.tabSize && line[n] == ' ') n++
    return n
  }
}
