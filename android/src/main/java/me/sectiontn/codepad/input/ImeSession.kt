package me.sectiontn.codepad.input

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
