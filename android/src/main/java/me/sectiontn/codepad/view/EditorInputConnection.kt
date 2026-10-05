package me.sectiontn.codepad.view

import android.os.Build
import android.text.TextUtils
import android.view.KeyEvent
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.SurroundingText
import android.view.inputmethod.TextAttribute
import androidx.annotation.RequiresApi
import me.sectiontn.codepad.input.ImeSession

/** Unwraps framework types for [ImeSession] and routes editor actions to the view. */
class EditorInputConnection(private val view: CodeEditorView) : BaseInputConnection(view, false) {
  private val session: ImeSession get() = view.ime

  override fun commitText(text: CharSequence?, newCursorPosition: Int): Boolean =
    edit { session.commitText(text?.toString() ?: "", newCursorPosition) }

  override fun setComposingText(text: CharSequence?, newCursorPosition: Int): Boolean =
    edit { session.setComposingText(text?.toString() ?: "", newCursorPosition) }

  override fun setComposingRegion(start: Int, end: Int): Boolean = edit { session.setComposingRegion(start, end) }

  override fun finishComposingText(): Boolean = edit { session.finishComposingText() }

  @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
  override fun replaceText(start: Int, end: Int, text: CharSequence, newCursorPosition: Int, textAttribute: TextAttribute?): Boolean =
    edit { session.replaceText(start, end, text.toString(), newCursorPosition) }

  override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean =
    edit { session.deleteSurroundingText(beforeLength, afterLength) }

  override fun deleteSurroundingTextInCodePoints(beforeLength: Int, afterLength: Int): Boolean =
    edit { session.deleteSurroundingTextInCodePoints(beforeLength, afterLength) }

  override fun setSelection(start: Int, end: Int): Boolean = edit { session.setSelection(start, end) }

  override fun getTextBeforeCursor(n: Int, flags: Int): CharSequence = session.textBeforeCursor(n)

  override fun getTextAfterCursor(n: Int, flags: Int): CharSequence = session.textAfterCursor(n)

  override fun getSelectedText(flags: Int): CharSequence? = session.selectedText()

  @RequiresApi(Build.VERSION_CODES.S)
  override fun getSurroundingText(beforeLength: Int, afterLength: Int, flags: Int): SurroundingText {
    val w = session.window(beforeLength, afterLength)
    return SurroundingText(w.text, w.selStart, w.selEnd, w.offset)
  }

  override fun beginBatchEdit(): Boolean = session.beginBatchEdit()

  override fun endBatchEdit(): Boolean {
    val more = session.endBatchEdit()
    if (!more) view.onImeBatchEnded()
    return more
  }

  // Dispatched straight to the view, so the key lands before the keyboard's next call reads the text.
  override fun sendKeyEvent(event: KeyEvent): Boolean = view.dispatchKeyEvent(event)

  override fun performEditorAction(actionCode: Int): Boolean = edit { view.insertNewlineFromIme() }

  override fun performContextMenuAction(id: Int): Boolean {
    when (id) {
      android.R.id.selectAll -> view.selectAll()
      android.R.id.cut -> view.cut()
      android.R.id.copy -> view.copy()
      android.R.id.paste -> view.paste()
      android.R.id.undo -> view.undo()
      android.R.id.redo -> view.redo()
      else -> return false
    }
    return true
  }

  override fun requestCursorUpdates(cursorUpdateMode: Int): Boolean {
    view.requestCursorUpdates(cursorUpdateMode)
    return true
  }

  @RequiresApi(Build.VERSION_CODES.TIRAMISU)
  override fun requestCursorUpdates(cursorUpdateMode: Int, cursorUpdateFilter: Int): Boolean = requestCursorUpdates(cursorUpdateMode)

  override fun getCursorCapsMode(reqModes: Int): Int {
    val w = session.window(CAPS_WINDOW, 0)
    return TextUtils.getCapsMode(w.text, w.selStart, reqModes)
  }

  override fun clearMetaKeyStates(states: Int): Boolean = true

  override fun closeConnection() {
    session.reset()
    super.closeConnection()
  }

  private inline fun edit(block: () -> Boolean): Boolean {
    view.markInputTime()
    return block()
  }

  private companion object {
    const val CAPS_WINDOW = 512
  }
}
