package me.sectiontn.codepad.core

import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

class EditorCore(initialText: String = "", private val clock: () -> Long = System::currentTimeMillis) {
  val document = Document(initialText)
  val lock = ReentrantReadWriteLock()
  var settings = EditorSettings()
  var selection: Selection = Selection(0, 0)
    private set

  var onChange: ((Change, ChangeOrigin) -> Unit)? = null
  var onSelectionChange: ((Selection) -> Unit)? = null

  /** Synchronous reads from the JS thread. Writers take the lock only inside Document.replace. */
  fun <T> read(block: () -> T): T = lock.read(block)

  fun replace(start: Int, end: Int, text: String, origin: ChangeOrigin = ChangeOrigin.Api): Change {
    val before = selection
    val change = lock.write { document.replace(start, end, text) }
    moveSelection(Selection(mapOffset(before.anchor, change), mapOffset(before.head, change)))
    onChange?.invoke(change, origin)
    return change
  }

  fun setSelection(anchor: Int, head: Int) {
    val max = document.length
    moveSelection(Selection(anchor.coerceIn(0, max), head.coerceIn(0, max)))
  }

  fun selectAll() = moveSelection(Selection(0, document.length))

  fun move(unit: TextMovement.Unit, forward: Boolean, extend: Boolean) {
    val doc = document
    val collapsing = !extend && !selection.isEmpty && unit == TextMovement.Unit.Char
    val from = if (collapsing) (if (forward) selection.max else selection.min) else selection.head
    val target = when (unit) {
      TextMovement.Unit.Char -> when {
        collapsing -> from
        forward -> TextMovement.nextGrapheme(doc, from)
        else -> TextMovement.prevGrapheme(doc, from)
      }
      TextMovement.Unit.Word -> if (forward) TextMovement.nextWordEnd(doc, from) else TextMovement.prevWordStart(doc, from)
      TextMovement.Unit.LineStart -> doc.lineStart(doc.lineAt(from))
      TextMovement.Unit.LineEnd -> doc.lineEnd(doc.lineAt(from))
      TextMovement.Unit.DocStart -> 0
      TextMovement.Unit.DocEnd -> doc.length
    }
    moveSelection(if (extend) Selection(selection.anchor, target) else Selection.caret(target))
  }

  fun selectWordAt(offset: Int) {
    val r = TextMovement.wordRangeAt(document, offset)
    moveSelection(Selection(r.start, r.end))
  }

  private fun moveSelection(next: Selection) {
    if (next == selection) return
    selection = next
    onSelectionChange?.invoke(next)
  }

  companion object {
    /** Maps an offset through a change. A caret sitting exactly at a pure insertion follows the insert. */
    fun mapOffset(offset: Int, c: Change): Int = when {
      offset < c.start -> offset
      offset == c.start -> if (c.removed.isEmpty()) c.newEnd else offset
      offset >= c.end -> offset + c.delta
      else -> c.newEnd
    }
  }
}
