package me.sectiontn.codepad.core

data class Position(val line: Int, val column: Int)

data class Range(val start: Int, val end: Int) {
  val length: Int get() = end - start
  val isEmpty: Boolean get() = start == end
}

data class Selection(val anchor: Int, val head: Int) {
  val min: Int get() = minOf(anchor, head)
  val max: Int get() = maxOf(anchor, head)
  val isEmpty: Boolean get() = anchor == head
  val range: Range get() = Range(min, max)

  companion object {
    fun caret(offset: Int): Selection = Selection(offset, offset)
  }
}

enum class ChangeOrigin { Input, Api, Undo, Redo }

/** One replacement: [start, end) of the old text became [start, newEnd) of the new text. */
data class Change(val start: Int, val removed: String, val inserted: String, val revision: Int) {
  val end: Int get() = start + removed.length
  val newEnd: Int get() = start + inserted.length
  val delta: Int get() = inserted.length - removed.length
}

data class EditorSettings(
  val tabSize: Int = 4,
  val insertSpaces: Boolean = true,
  val autoIndent: Boolean = true,
  val autoCloseBrackets: Boolean = true,
)
