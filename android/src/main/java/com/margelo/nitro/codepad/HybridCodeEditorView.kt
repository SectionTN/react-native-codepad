package com.margelo.nitro.codepad

import android.view.View
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.core.Promise
import me.sectiontn.codepad.view.CodeEditorView

@DoNotStrip
class HybridCodeEditorView(val context: ThemedReactContext) : HybridCodeEditorViewSpec() {
  private val editor = CodeEditorView(context)
  private var loaded = false
  private var readySent = false

  override val view: View = editor

  override var initialValue: String? = null
    set(value) {
      field = value
      if (!loaded && value != null) {
        loaded = true
        editor.setInitialText(value)
      }
    }

  override var onReady: (() -> Unit)? = null

  override fun getText(): String = editor.core.let { c -> c.read { c.document.text() } }

  override fun getLength(): Double = editor.core.let { c -> c.read { c.document.length.toDouble() } }

  override fun getLineCount(): Double = editor.core.let { c -> c.read { c.document.lineCount.toDouble() } }

  override fun getLine(index: Double): String = editor.core.let { c -> c.read { c.document.line(index.toInt()).toString() } }

  override fun getRevision(): Double = editor.core.let { c -> c.read { c.document.revision.toDouble() } }

  override fun setText(text: String, keepHistory: Boolean): Promise<Unit> {
    val promise = Promise<Unit>()
    editor.post {
      editor.core.setText(text, keepHistory)
      editor.invalidate()
      promise.resolve(Unit)
    }
    return promise
  }

  override fun afterUpdate() {
    if (readySent) return
    editor.post {
      if (!readySent) {
        readySent = true
        onReady?.invoke()
      }
    }
  }
}
