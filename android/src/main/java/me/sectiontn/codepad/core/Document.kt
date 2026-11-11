package me.sectiontn.codepad.core

import me.sectiontn.codepad.syntax.CoreNative

/**
 * The core's document: lines of UTF-16 units joined by `\n`, so every offset is the index JavaScript strings use.
 * Edits go through [EditorCore]. The main thread reads freely, other threads inside [EditorCore.read].
 */
class Document internal constructor(private val core: EditorCore) {
  internal val handle: Long get() = core.handle()

  val length: Int get() = CoreNative.docLength(handle)
  val revision: Int get() = CoreNative.docRevision(handle)
  val lineCount: Int get() = CoreNative.docLineCount(handle)

  fun line(index: Int): CharSequence = if (index in 0 until lineCount) text(lineStart(index), lineEnd(index)) else ""

  fun lineLength(index: Int): Int = lineEnd(index) - lineStart(index)

  /** Start offset of line [index]. `index == lineCount` yields `length + 1` so the prefix sums stay uniform. */
  fun lineStart(index: Int): Int = CoreNative.docLineStart(handle, index)

  fun lineEnd(index: Int): Int = CoreNative.docLineEnd(handle, index)

  fun lineAt(offset: Int): Int = CoreNative.docLineAt(handle, offset)

  fun offsetToPosition(offset: Int): Position {
    val packed = CoreNative.docPosition(handle, offset)
    return Position((packed shr 32).toInt(), packed.toInt())
  }

  fun positionToOffset(line: Int, column: Int): Int = CoreNative.docOffset(handle, line, column)

  /** The unit at [offset], clamped into the document. A line end reads as the newline unit. */
  fun charAt(offset: Int): Char = CoreNative.docUnitAt(handle, offset)

  fun text(): String = text(0, length)

  fun text(start: Int, end: Int): String = CoreNative.docText(handle, start, end)
}
