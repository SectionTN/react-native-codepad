package me.sectiontn.codepad.view

import android.content.Context
import android.graphics.Canvas
import android.view.View
import me.sectiontn.codepad.core.EditorCore

class CodeEditorView(context: Context) : View(context) {
  // Replaced once when initialValue loads. The JS thread reads it, so the reference must be volatile.
  @Volatile
  var core: EditorCore = EditorCore()
    private set

  fun setInitialText(value: String) {
    core = EditorCore(value)
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    canvas.drawColor(0xFFFFFFFF.toInt())
  }
}
