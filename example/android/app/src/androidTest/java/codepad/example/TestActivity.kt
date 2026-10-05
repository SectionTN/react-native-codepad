package codepad.example

import android.app.Activity
import android.os.Bundle
import android.widget.FrameLayout
import me.sectiontn.codepad.view.CodeEditorView

/** Hosts one editor without the React runtime so the instrumented tests start fast. */
class TestActivity : Activity() {
  lateinit var editor: CodeEditorView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    editor = CodeEditorView(this)
    editor.setFont(null, 16f, 1.4f)
    setContentView(FrameLayout(this).apply { addView(editor, FrameLayout.LayoutParams(600, 400)) })
  }
}
