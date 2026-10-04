package com.margelo.nitro.codepad

import android.view.View
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
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

  override fun getText(): String = editor.text()

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
