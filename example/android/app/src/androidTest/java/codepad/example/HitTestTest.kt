package codepad.example

import android.os.SystemClock
import android.view.MotionEvent
import androidx.test.ext.junit.runners.AndroidJUnit4
import me.sectiontn.codepad.core.Gap
import me.sectiontn.codepad.core.Selection
import me.sectiontn.codepad.view.CodeEditorView
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class HitTestTest {
  private fun tap(editor: CodeEditorView, x: Float, y: Float) {
    val t0 = SystemClock.uptimeMillis()
    for ((action, t) in listOf(MotionEvent.ACTION_DOWN to t0, MotionEvent.ACTION_UP to t0 + 40)) {
      val e = MotionEvent.obtain(t0, t, action, x, y, 0)
      editor.dispatchTouchEvent(e)
      e.recycle()
    }
  }

  @Test
  fun tapInAGapLeavesTheCaret() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText((0 until 6).joinToString("\n") { "line $it" })
        layout(editor)
        editor.setDecorations(listOf(Gap(1, 2)), -1)
        draw(editor)
        val density = editor.resources.displayMetrics.density
        val g = editor.gapRect(1) ?: error("no gap rect")
        editor.core.setSelection(3, 3)
        tap(editor, g.centerX() * density, g.centerY() * density)
        assertEquals(Selection(3, 3), editor.core.selection)
        // The row right under the gap is line 2, and a tap there still moves the caret.
        tap(editor, 20f, (g.bottom + 2f) * density)
        assertEquals(2, editor.core.document.lineAt(editor.core.selection.head))
      }
    }
  }

  @Test
  fun pointsMapBackToTheOffsetsTheyWereDrawnAt() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setLineNumbers(false)
        editor.setInitialText("abcdef\n" + "x".repeat(80))
        val density = editor.resources.displayMetrics.density
        for (wrap in listOf(false, true)) {
          editor.setSoftWrap(wrap)
          layout(editor)
          for (offset in intArrayOf(0, 3, 6, 7, 40, 87)) {
            editor.core.setSelection(offset, offset)
            draw(editor)
            val caret = editor.frame.caret ?: error("no caret rect at $offset")
            val x = caret.left * density + 2f
            val y = (caret.top + caret.height() / 2f) * density
            assertEquals("wrap $wrap offset $offset", offset, editor.offsetAt(x, y))
          }
          editor.core.setSelection(0, 0)
          draw(editor)
          val row0 = ((editor.frame.caret ?: error("no caret")).top + 2f) * density
          assertEquals("wrap $wrap far right", 6, editor.offsetAt(599f, row0))
          assertEquals("wrap $wrap far left", 0, editor.offsetAt(0f, row0))
          // The wrapped rows can outgrow the 400 px view on dense screens, so probe just past the content, not a fixed y.
          val below = editor.frame.contentHeight * density + 10f
          assertEquals("wrap $wrap below", editor.core.document.length, editor.offsetAt(300f, below))
        }
      }
    }
  }
}
