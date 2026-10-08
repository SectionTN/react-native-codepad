package codepad.example

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ContentSizeTest {
  // A relayout would reset every row count to one; measured rows above the viewport must survive a height change.
  @Test
  fun heightOnlyResizeKeepsTheMeasuredRows() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setSoftWrap(true)
        editor.setInitialText(List(100) { "word ".repeat(60) }.joinToString("\n"))
        layout(editor)
        draw(editor)
        editor.scrollToLine(50, false)
        draw(editor)
        val before = editor.frame.contentHeight
        assertTrue("rows measured beyond one per line, height $before", before > 100 * 16 * 1.4f)
        layout(editor, 600, 500)
        draw(editor)
        val after = editor.frame.contentHeight
        assertTrue("measured rows kept after a taller view, before $before after $after", after >= before)
      }
    }
  }
}
