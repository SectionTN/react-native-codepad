package me.sectiontn.codepad.core

import me.sectiontn.codepad.syntax.CoreNative

/**
 * The core's document: lines of UTF-16 units joined by `\n`, so every offset is the index JavaScript strings use.
 * Edits go through [EditorCore]. The main thread reads freely, other threads inside [EditorCore.read].
 */
class Document internal constructor(private val core: EditorCore) {
  internal val handle: Long get() = core.handle()

  /** The thread of a draw in progress with codepad_debug on. Its reads must come from the draw's frame. */
  @Volatile internal var drawingThread: Thread? = null

  // Only the drawing thread is checked: the JS thread reads under the shared lock at any time.
  private fun checked(): Long {
    check(drawingThread !== Thread.currentThread()) { "the document was read during a draw: take it from the frame" }
    return core.handle()
  }

  val length: Int get() = CoreNative.docLength(checked())
  val revision: Int get() = CoreNative.docRevision(checked())
  val lineCount: Int get() = CoreNative.docLineCount(checked())

  fun line(index: Int): CharSequence = if (index in 0 until lineCount) text(lineStart(index), lineEnd(index)) else ""

  /** A line a draw needs outside its frame's window, such as an off-screen selection end. Not checked. */
  fun lineOutsideFrame(index: Int): String {
    val h = core.handle()
    if (index !in 0 until CoreNative.docLineCount(h)) return ""
    return CoreNative.docText(h, CoreNative.docLineStart(h, index), CoreNative.docLineEnd(h, index))
  }

  fun lineLength(index: Int): Int = lineEnd(index) - lineStart(index)

  /** Start offset of line [index]. `index == lineCount` yields `length + 1` so the prefix sums stay uniform. */
  fun lineStart(index: Int): Int = CoreNative.docLineStart(checked(), index)

  fun lineEnd(index: Int): Int = CoreNative.docLineEnd(checked(), index)

  fun lineAt(offset: Int): Int = CoreNative.docLineAt(checked(), offset)

  fun offsetToPosition(offset: Int): Position {
    val packed = CoreNative.docPosition(checked(), offset)
    return Position((packed shr 32).toInt(), packed.toInt())
  }

  fun positionToOffset(line: Int, column: Int): Int = CoreNative.docOffset(checked(), line, column)

  /** The unit at [offset], clamped into the document. A line end reads as the newline unit. */
  fun charAt(offset: Int): Char = CoreNative.docUnitAt(checked(), offset)

  fun text(): String = text(0, length)

  fun text(start: Int, end: Int): String = CoreNative.docText(checked(), start, end)
}
