package me.sectiontn.codepad.view

import android.content.Context
import android.graphics.Matrix
import android.graphics.RectF
import android.os.Build
import android.text.InputType
import android.text.TextUtils
import android.view.View
import android.view.inputmethod.CursorAnchorInfo
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager
import me.sectiontn.codepad.core.Range
import me.sectiontn.codepad.core.Selection
import me.sectiontn.codepad.input.ImeSession

/** Every InputMethodManager call the editor makes, in one place. */
class InputMethodBridge(private val view: View) {
  enum class Suggestions { Off, ForceOff, On }

  private val imm = view.context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
  private val location = IntArray(2)
  private var cursorUpdateMode = 0

  val monitorsCursor: Boolean get() = cursorUpdateMode and InputConnection.CURSOR_UPDATE_MONITOR != 0

  fun showKeyboard() {
    imm.showSoftInput(view, 0)
  }

  fun hideKeyboard() {
    imm.hideSoftInputFromWindow(view.windowToken, 0)
  }

  fun restartInput() {
    imm.restartInput(view)
  }

  fun updateSelection(selection: Selection, composing: Range?) {
    imm.updateSelection(view, selection.anchor, selection.head, composing?.start ?: -1, composing?.end ?: -1)
  }

  /** Returns true when the keyboard wants one update right away. */
  fun requestCursorUpdates(mode: Int): Boolean {
    cursorUpdateMode = mode
    return mode and InputConnection.CURSOR_UPDATE_IMMEDIATE != 0
  }

  fun sendCursorAnchorInfo(selection: Selection, caret: RectF?, baseline: Float, composingStart: Int, composingText: String?, bounds: List<RectF>) {
    val b = CursorAnchorInfo.Builder().setSelectionRange(selection.min, selection.max)
    if (caret != null) {
      val visible = caret.bottom > 0f && caret.top < view.height
      val flags = if (visible) CursorAnchorInfo.FLAG_HAS_VISIBLE_REGION else CursorAnchorInfo.FLAG_HAS_INVISIBLE_REGION
      b.setInsertionMarkerLocation(caret.left, caret.top, baseline, caret.bottom, flags)
    }
    if (composingText != null) {
      b.setComposingText(composingStart, composingText)
      bounds.forEachIndexed { i, r ->
        b.addCharacterBounds(composingStart + i, r.left, r.top, r.right, r.bottom, CursorAnchorInfo.FLAG_HAS_VISIBLE_REGION)
      }
    }
    view.getLocationOnScreen(location)
    b.setMatrix(Matrix().apply { setTranslate(location[0].toFloat(), location[1].toFloat()) })
    imm.updateCursorAnchorInfo(view, b.build())
  }

  fun fillEditorInfo(info: EditorInfo, suggestions: Suggestions, hint: String?, selection: Selection, window: ImeSession.Window) {
    info.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or when (suggestions) {
      Suggestions.Off -> InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
      Suggestions.ForceOff -> InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
      Suggestions.On -> InputType.TYPE_TEXT_FLAG_AUTO_CORRECT
    }
    info.imeOptions = EditorInfo.IME_FLAG_NO_ENTER_ACTION or EditorInfo.IME_FLAG_NO_FULLSCREEN or EditorInfo.IME_FLAG_NO_EXTRACT_UI
    info.initialSelStart = selection.min
    info.initialSelEnd = selection.max
    info.initialCapsMode = TextUtils.getCapsMode(window.text, window.selStart, info.inputType)
    info.hintText = hint
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) info.setInitialSurroundingSubText(window.text, window.offset)
  }
}
