package me.sectiontn.codepad.view

import android.content.Context
import android.graphics.Canvas
import android.view.View

class CodeEditorView(context: Context) : View(context) {
  private var text: String = ""

  fun setInitialText(value: String) {
    text = value
    invalidate()
  }

  fun text(): String = text

  override fun onDraw(canvas: Canvas) {
    canvas.drawColor(0xFFFFFFFF.toInt())
  }
}
