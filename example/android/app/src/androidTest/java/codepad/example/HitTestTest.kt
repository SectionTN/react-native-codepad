package codepad.example

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class HitTestTest {
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
