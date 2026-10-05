package me.sectiontn.codepad.input

import me.sectiontn.codepad.core.AutoCloser
import me.sectiontn.codepad.core.Change
import me.sectiontn.codepad.core.ChangeOrigin
import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.core.Range

/**
 * The IME protocol over the core: composing range, batch depth and the text windows a keyboard reads.
 * Pure Kotlin, so recorded keyboard sessions replay on the JVM.
 */
class ImeSession(private val core: EditorCore) {
  var composing: Range? = null
    private set

  var batchDepth = 0
    private set

  /** True while a session call mutates the core, so the view can tell IME edits from external ones. */
  var applying = false
    private set

  private var groupOpen = false
  private val doc get() = core.document

  fun commitText(text: String, newCursorPosition: Int): Boolean = mutate {
    val region = composing
    if (region != null) {
      replaceRegion(region, text)
      placeCaret(region.start, text.length, newCursorPosition)
      endComposition()
    } else {
      val start = core.selection.min
      when {
        text.isEmpty() -> if (!core.selection.isEmpty) core.insertText(text, ChangeOrigin.Input)
        text.codePointCount(0, text.length) == 1 -> core.typeText(text)
        else -> core.insertText(text, ChangeOrigin.Input)
      }
      if (newCursorPosition != 1) placeCaret(start, text.length, newCursorPosition)
    }
  }

  fun setComposingText(text: String, newCursorPosition: Int): Boolean = mutate {
    val region = composing ?: core.selection.range
    beginComposition()
    replaceRegion(region, text)
    composing = Range(region.start, region.start + text.length)
    placeCaret(region.start, text.length, newCursorPosition)
  }

  fun setComposingRegion(start: Int, end: Int): Boolean = mutate {
    val a = start.coerceIn(0, doc.length)
    val b = end.coerceIn(0, doc.length)
    composing = if (a == b) null else Range(minOf(a, b), maxOf(a, b))
    if (composing == null) closeGroup()
  }

  fun finishComposingText(): Boolean = mutate { endComposition() }

  data class Window(val text: String, val selStart: Int, val selEnd: Int, val offset: Int)

  /** Deletes around the selection, widened past the composing text, with the exact lengths the IME sent. */
  fun deleteSurroundingText(before: Int, after: Int): Boolean = mutate {
    val sel = core.selection
    val a = minOf(sel.min, composing?.start ?: sel.min)
    val b = maxOf(sel.max, composing?.end ?: sel.max)
    val single = before == 1 && after == 0 && sel.isEmpty && composing == null
    if (single && core.settings.autoCloseBrackets && AutoCloser.deletesPair(doc, a)) {
      core.inputReplace(a - 1, a + 1, "")
      return@mutate
    }
    deleteAround(maxOf(0, a - maxOf(0, before)), a, b, minOf(doc.length, b + maxOf(0, after)), single)
  }

  fun deleteSurroundingTextInCodePoints(before: Int, after: Int): Boolean = mutate {
    val sel = core.selection
    val a = minOf(sel.min, composing?.start ?: sel.min)
    val b = maxOf(sel.max, composing?.end ?: sel.max)
    var end = b
    var n = after
    while (n > 0 && end < doc.length) {
      end++
      if (end < doc.length && pairEndsAt(end)) end++
      n--
    }
    var start = a
    n = before
    while (n > 0 && start > 0) {
      start--
      if (start > 0 && pairEndsAt(start)) start--
      n--
    }
    deleteAround(start, a, b, end, typing = false)
  }

  fun textBeforeCursor(n: Int): String {
    val end = core.selection.min
    return doc.text(maxOf(0, end - n.coerceIn(0, MAX_WINDOW)), end)
  }

  fun textAfterCursor(n: Int): String {
    val start = core.selection.max
    return doc.text(start, minOf(doc.length, start + n.coerceIn(0, MAX_WINDOW)))
  }

  fun selectedText(): String? {
    val sel = core.selection
    return if (sel.isEmpty) null else doc.text(sel.min, sel.max)
  }

  fun composingText(): String? = composing?.let { doc.text(it.start, it.end) }

  /** The text around the selection with selection offsets relative to it, as SurroundingText wants them. */
  fun window(before: Int, after: Int): Window {
    val sel = core.selection
    val start = maxOf(0, sel.min - before.coerceIn(0, MAX_WINDOW))
    val end = minOf(doc.length, sel.max + after.coerceIn(0, MAX_WINDOW))
    return Window(doc.text(start, end), sel.min - start, sel.max - start, start)
  }

  fun setSelection(start: Int, end: Int): Boolean = mutate { core.setSelection(start, end) }

  fun beginBatchEdit(): Boolean {
    batchDepth++
    return true
  }

  /** Returns true while an outer batch is still open. */
  fun endBatchEdit(): Boolean {
    if (batchDepth > 0) batchDepth--
    return batchDepth > 0
  }

  /** A change the session did not make. Returns true when it hit the composing text, which the view answers with restartInput. */
  fun onExternalChange(change: Change): Boolean {
    val c = composing ?: return false
    closeGroup()
    val inside = change.start > c.start && change.start < c.end
    val overlaps = change.start < c.end && change.end > c.start
    if (inside || overlaps) {
      composing = null
      return true
    }
    if (change.start <= c.start) composing = Range(c.start + change.delta, c.end + change.delta)
    return false
  }

  fun reset() {
    composing = null
    closeGroup()
    batchDepth = 0
  }

  /** Deletes [b, end) then [start, a) as one undo step and shifts the composing range past the gap before it. */
  private fun deleteAround(start: Int, a: Int, b: Int, end: Int, typing: Boolean) {
    val both = start < a && end > b
    if (both) core.undo.beginGroup(core.selection)
    if (end > b) core.inputReplace(b, end, "")
    if (start < a) {
      core.inputReplace(start, a, "", typing)
      composing = composing?.let { Range(it.start - (a - start), it.end - (a - start)) }
    }
    if (both) core.undo.endGroup(core.selection)
  }

  private fun pairEndsAt(index: Int): Boolean =
    Character.isLowSurrogate(doc.charAt(index)) && Character.isHighSurrogate(doc.charAt(index - 1))

  private companion object {
    const val MAX_WINDOW = 8192
  }

  /** Replaces [region] with [text] through the smallest edit, so growing a composition by one char is a one char insert. */
  private fun replaceRegion(region: Range, text: String) {
    val old = doc.text(region.start, region.end)
    val shortest = minOf(old.length, text.length)
    var prefix = 0
    while (prefix < shortest && old[prefix] == text[prefix]) prefix++
    if (prefix in 1 until text.length && Character.isHighSurrogate(text[prefix - 1])) prefix--
    var suffix = 0
    while (suffix < shortest - prefix && old[old.length - 1 - suffix] == text[text.length - 1 - suffix]) suffix++
    if (suffix in 1 until text.length - prefix && Character.isLowSurrogate(text[text.length - suffix])) suffix--
    if (prefix == old.length && prefix == text.length) return
    core.inputReplace(region.start + prefix, region.end - suffix, text.substring(prefix, text.length - suffix))
  }

  /** The InputConnection caret rule: positive counts from the end of the new text, zero or less from its start. */
  private fun placeCaret(start: Int, length: Int, newCursorPosition: Int) {
    val caret = if (newCursorPosition > 0) start + length + newCursorPosition - 1 else start + newCursorPosition
    core.setSelection(caret, caret)
  }

  private fun beginComposition() {
    if (groupOpen) return
    groupOpen = true
    core.undo.beginGroup(core.selection)
  }

  private fun endComposition() {
    composing = null
    closeGroup()
  }

  private fun closeGroup() {
    if (!groupOpen) return
    groupOpen = false
    core.undo.endGroup(core.selection)
  }

  private inline fun mutate(block: () -> Unit): Boolean {
    applying = true
    try {
      block()
    } finally {
      applying = false
    }
    return true
  }
}
