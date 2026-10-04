package me.sectiontn.codepad.core

import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

class EditorCore(initialText: String = "", private val clock: () -> Long = System::currentTimeMillis) {
  val document = Document(initialText)
  val lock = ReentrantReadWriteLock()
  val undo = UndoManager(clock)
  var settings = EditorSettings()
  var selection: Selection = Selection(0, 0)
    private set

  var onChange: ((Change, ChangeOrigin) -> Unit)? = null
  var onSelectionChange: ((Selection) -> Unit)? = null

  val canUndo: Boolean get() = undo.canUndo
  val canRedo: Boolean get() = undo.canRedo

  /** Synchronous reads from the JS thread. Writers take the lock only inside Document.replace. */
  fun <T> read(block: () -> T): T = lock.read(block)

  fun replace(start: Int, end: Int, text: String, origin: ChangeOrigin = ChangeOrigin.Api): Change =
    applyChange(start, end, text, origin, typing = false, caretAfter = false)

  /**
   * Every mutation goes through here. [typing] marks single key input that may coalesce in the undo
   * history. [caretAfter] puts a collapsed caret after the inserted text instead of mapping the selection.
   */
  internal fun applyChange(start: Int, end: Int, text: String, origin: ChangeOrigin, typing: Boolean, caretAfter: Boolean): Change {
    val before = selection
    val change = lock.write { document.replace(start, end, text) }
    val after = if (caretAfter) Selection.caret(change.newEnd)
      else Selection(mapOffset(before.anchor, change), mapOffset(before.head, change))
    moveSelection(after, fromEdit = true)
    if (origin == ChangeOrigin.Input || origin == ChangeOrigin.Api) undo.record(change, before, after, typing)
    onChange?.invoke(change, origin)
    return change
  }

  fun insertText(text: String) {
    applyChange(selection.min, selection.max, text, ChangeOrigin.Api, typing = false, caretAfter = true)
  }

  fun setText(text: String, keepHistory: Boolean = false) {
    applyChange(0, document.length, text, ChangeOrigin.Api, typing = false, caretAfter = false)
    moveSelection(Selection(0, 0), fromEdit = true)
    if (!keepHistory) undo.clear()
  }

  fun typeText(text: String) {
    var i = 0
    while (i < text.length) {
      val unit = String(Character.toChars(text.codePointAt(i)))
      typeUnit(unit)
      i += unit.length
    }
  }

  /** One unit of user input, a code point or an IME commit. */
  internal fun typeUnit(s: String) {
    applyChange(selection.min, selection.max, s, ChangeOrigin.Input, typing = s.codePointCount(0, s.length) == 1, caretAfter = true)
  }

  fun backspace() {
    if (!selection.isEmpty) {
      applyChange(selection.min, selection.max, "", ChangeOrigin.Input, typing = false, caretAfter = true)
      return
    }
    val caret = selection.head
    if (caret == 0) return
    val from = TextMovement.prevGrapheme(document, caret)
    applyChange(from, caret, "", ChangeOrigin.Input, typing = caret - from == 1, caretAfter = true)
  }

  fun delete() {
    if (!selection.isEmpty) {
      applyChange(selection.min, selection.max, "", ChangeOrigin.Input, typing = false, caretAfter = true)
      return
    }
    val caret = selection.head
    if (caret >= document.length) return
    applyChange(caret, TextMovement.nextGrapheme(document, caret), "", ChangeOrigin.Input, typing = false, caretAfter = true)
  }

  fun undo(): Boolean {
    val group = undo.popUndo() ?: return false
    for (i in group.changes.indices.reversed()) {
      val c = group.changes[i]
      val change = lock.write { document.replace(c.start, c.newEnd, c.removed) }
      onChange?.invoke(change, ChangeOrigin.Undo)
    }
    moveSelection(clamped(group.selectionBefore), fromEdit = true)
    return true
  }

  fun redo(): Boolean {
    val group = undo.popRedo() ?: return false
    for (c in group.changes) {
      val change = lock.write { document.replace(c.start, c.end, c.inserted) }
      onChange?.invoke(change, ChangeOrigin.Redo)
    }
    moveSelection(clamped(group.selectionAfter), fromEdit = true)
    return true
  }

  fun setSelection(anchor: Int, head: Int) = moveSelection(clamped(Selection(anchor, head)))

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

  private fun clamped(s: Selection): Selection {
    val max = document.length
    return Selection(s.anchor.coerceIn(0, max), s.head.coerceIn(0, max))
  }

  private fun moveSelection(next: Selection, fromEdit: Boolean = false) {
    if (next == selection) return
    if (!fromEdit) undo.selectionDirty = true
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
