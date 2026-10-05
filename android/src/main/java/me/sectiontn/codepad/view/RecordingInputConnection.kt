package me.sectiontn.codepad.view

import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.view.KeyEvent
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputConnectionWrapper
import android.view.inputmethod.SurroundingText
import android.view.inputmethod.TextAttribute
import androidx.annotation.RequiresApi
import me.sectiontn.codepad.core.Selection
import org.json.JSONArray
import org.json.JSONObject

/** Logs every call the keyboard makes, its result and the document after it, one JSON line per call. */
class RecordingInputConnection(target: InputConnection, private val view: CodeEditorView) : InputConnectionWrapper(target, false) {
  private val opened = SystemClock.uptimeMillis()

  init {
    val open = JSONObject()
      .put("ime", Settings.Secure.getString(view.context.contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD) ?: "")
      .put("inputType", view.lastInputType)
    log("open", args(), null, false, open)
  }

  override fun commitText(text: CharSequence?, newCursorPosition: Int): Boolean =
    record("commitText", args(text.toString(), newCursorPosition)) { super.commitText(text, newCursorPosition) }

  override fun setComposingText(text: CharSequence?, newCursorPosition: Int): Boolean =
    record("setComposingText", args(text.toString(), newCursorPosition)) { super.setComposingText(text, newCursorPosition) }

  override fun setComposingRegion(start: Int, end: Int): Boolean =
    record("setComposingRegion", args(start, end)) { super.setComposingRegion(start, end) }

  override fun finishComposingText(): Boolean = record("finishComposingText", args()) { super.finishComposingText() }

  @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
  override fun replaceText(start: Int, end: Int, text: CharSequence, newCursorPosition: Int, textAttribute: TextAttribute?): Boolean =
    record("replaceText", args(start, end, text.toString(), newCursorPosition)) { super.replaceText(start, end, text, newCursorPosition, textAttribute) }

  override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean =
    record("deleteSurroundingText", args(beforeLength, afterLength)) { super.deleteSurroundingText(beforeLength, afterLength) }

  override fun deleteSurroundingTextInCodePoints(beforeLength: Int, afterLength: Int): Boolean =
    record("deleteSurroundingTextInCodePoints", args(beforeLength, afterLength)) { super.deleteSurroundingTextInCodePoints(beforeLength, afterLength) }

  override fun getTextBeforeCursor(n: Int, flags: Int): CharSequence? =
    record("getTextBeforeCursor", args(n, flags)) { super.getTextBeforeCursor(n, flags) }

  override fun getTextAfterCursor(n: Int, flags: Int): CharSequence? =
    record("getTextAfterCursor", args(n, flags)) { super.getTextAfterCursor(n, flags) }

  override fun getSelectedText(flags: Int): CharSequence? = record("getSelectedText", args(flags)) { super.getSelectedText(flags) }

  @RequiresApi(Build.VERSION_CODES.S)
  override fun getSurroundingText(beforeLength: Int, afterLength: Int, flags: Int): SurroundingText? =
    record("getSurroundingText", args(beforeLength, afterLength, flags)) { super.getSurroundingText(beforeLength, afterLength, flags) }

  override fun setSelection(start: Int, end: Int): Boolean = record("setSelection", args(start, end)) { super.setSelection(start, end) }

  override fun beginBatchEdit(): Boolean = record("beginBatchEdit", args()) { super.beginBatchEdit() }

  override fun endBatchEdit(): Boolean = record("endBatchEdit", args()) { super.endBatchEdit() }

  override fun sendKeyEvent(event: KeyEvent): Boolean =
    record("sendKeyEvent", args(event.action, event.keyCode, event.metaState)) { super.sendKeyEvent(event) }

  override fun performEditorAction(actionCode: Int): Boolean =
    record("performEditorAction", args(actionCode)) { super.performEditorAction(actionCode) }

  override fun performContextMenuAction(id: Int): Boolean =
    record("performContextMenuAction", args(id)) { super.performContextMenuAction(id) }

  override fun requestCursorUpdates(cursorUpdateMode: Int): Boolean =
    record("requestCursorUpdates", args(cursorUpdateMode)) { super.requestCursorUpdates(cursorUpdateMode) }

  override fun getCursorCapsMode(reqModes: Int): Int = record("getCursorCapsMode", args(reqModes)) { super.getCursorCapsMode(reqModes) }

  override fun clearMetaKeyStates(states: Int): Boolean = record("clearMetaKeyStates", args(states)) { super.clearMetaKeyStates(states) }

  override fun closeConnection() {
    super.closeConnection()
    log("close", args(), null, false, null)
  }

  /** Caret moves made by taps or hardware keys, which the keyboard only learns about from updateSelection. */
  fun logSelection(selection: Selection) = log("select", args(selection.anchor, selection.head), null, false, null)

  private fun args(vararg values: Any?): JSONArray = JSONArray().also { a -> values.forEach { a.put(it ?: JSONObject.NULL) } }

  private inline fun <T> record(call: String, args: JSONArray, block: () -> T): T {
    val result = block()
    log(call, args, result, true, null)
    return result
  }

  private fun log(call: String, args: JSONArray, result: Any?, hasResult: Boolean, extra: JSONObject?) {
    val line = JSONObject().put("t", SystemClock.uptimeMillis() - opened).put("call", call).put("args", args)
    if (hasResult) line.put("ret", encode(result))
    line.put("after", view.imeState())
    if (extra != null) for (key in extra.keys()) line.put(key, extra.get(key))
    Log.i(DebugSwitch.TAG, line.toString())
  }

  private fun encode(result: Any?): Any = when {
    result == null -> JSONObject.NULL
    result is CharSequence -> result.toString()
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && result is SurroundingText ->
      JSONObject().put("text", result.text.toString()).put("selStart", result.selectionStart).put("selEnd", result.selectionEnd).put("offset", result.offset)
    else -> result
  }
}
