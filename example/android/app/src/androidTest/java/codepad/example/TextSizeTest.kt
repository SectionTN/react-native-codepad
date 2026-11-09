package codepad.example

import android.graphics.Paint
import android.graphics.Typeface
import androidx.test.ext.junit.runners.AndroidJUnit4
import me.sectiontn.codepad.view.CodeEditorView
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.floor

private const val COLUMNS = 80

@RunWith(AndroidJUnit4::class)
class TextSizeTest {
  @Test
  fun columnsAdvanceByTheFontMetricAtTheExactSize() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("x".repeat(COLUMNS))
        val px = fractionalSize(editor)
        val em = Paint(Paint.LINEAR_TEXT_FLAG).apply { typeface = Typeface.MONOSPACE; textSize = 1000f }
          .getRunAdvance("x", 0, 1, 0, 1, false, 1) / 1000f
        assertEquals("$COLUMNS columns at $px px", em * px * COLUMNS, caretPx(editor, COLUMNS) - caretPx(editor, 0), 0.5f)
      }
    }
  }

  @Test
  fun aTabEndsWhereTabSizeSpacesEnd() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        val tab = editor.core.settings.tabSize
        editor.setInitialText("\tx\n" + " ".repeat(tab) + "x")
        val px = fractionalSize(editor)
        assertEquals("tab size $tab at $px px", caretPx(editor, 3 + tab), caretPx(editor, 1), 0.5f)
      }
    }
  }

  // Three quarters past a whole pixel, where hinted advances drift furthest from the font's metric.
  private fun fractionalSize(editor: CodeEditorView): Float {
    val density = editor.resources.displayMetrics.density
    val px = floor(14f * density) + 0.75f
    editor.setLineNumbers(false)
    editor.setFont(null, px / density, 1.4f)
    layout(editor, width = 2000)
    return px
  }

  private fun caretPx(editor: CodeEditorView, offset: Int): Float {
    editor.core.setSelection(offset, offset)
    draw(editor)
    return (editor.frame.caret ?: error("no caret rect at $offset")).left * editor.resources.displayMetrics.density
  }
}
