package codepad.example

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlin.math.abs
import me.sectiontn.codepad.core.LineBackground
import me.sectiontn.codepad.core.Underline
import me.sectiontn.codepad.core.UnderlineStyle
import me.sectiontn.codepad.view.CodeEditorView
import me.sectiontn.codepad.view.ThemeColors
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DecorationPaintTest {
  private val red = 0xFFC8322B.toInt()
  private val tint = 0xFFFAE8E6.toInt()

  private fun near(a: Int, b: Int): Boolean =
    abs((a shr 16 and 0xff) - (b shr 16 and 0xff)) <= 3 &&
      abs((a shr 8 and 0xff) - (b shr 8 and 0xff)) <= 3 &&
      abs((a and 0xff) - (b and 0xff)) <= 3

  private fun redRows(bitmap: Bitmap, x: Int): List<Int> = (0 until bitmap.height).filter { near(bitmap.getPixel(x, it), red) }

  private fun caretLeft(editor: CodeEditorView, offset: Int): Float {
    editor.core.setSelection(offset, offset)
    draw(editor)
    return (editor.frame.caret ?: error("no caret at $offset")).left
  }

  private fun theme(activeLine: Int): ThemeColors = ThemeColors.default.let {
    ThemeColors(
      it.background, it.foreground, it.gutterBackground, it.gutterForeground, it.gutterActiveForeground,
      activeLine, it.selection, it.cursor, it.matchingBracket, it.searchMatch, it.searchMatchActive, emptyMap(),
    )
  }

  @Test
  fun solidUnderlineSitsOffsetBelowTheBaseline() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        val density = editor.resources.displayMetrics.density
        editor.setLineNumbers(false)
        editor.setInitialText("if T[j] < T[i]:")
        layout(editor)
        // The middle of the T at offset 10: its lowest ink row sits on the baseline.
        val x = ((caretLeft(editor, 10) + caretLeft(editor, 11)) / 2f * density).toInt()
        editor.core.setSelection(0, 0)
        val plain = draw(editor)
        val baseline = (0 until plain.height).last { (plain.getPixel(x, it) and 0xff) < 100 && (plain.getPixel(x, it) ushr 24) > 0 } + 1
        editor.setDecorations(listOf(Underline(10, 14, red, UnderlineStyle.Solid, 2f, 4f)), -1)
        val rows = redRows(draw(editor), x)
        assertTrue("no underline under the T", rows.isNotEmpty())
        assertEquals("top below the baseline", 4f * density, (rows.first() - baseline).toFloat(), 1.5f)
        assertEquals("thickness", 2f * density, rows.size.toFloat(), 1.5f)
      }
    }
  }

  @Test
  fun lineBackgroundCoversTheActiveLine() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        val density = editor.resources.displayMetrics.density
        editor.setLineNumbers(false)
        editor.setTheme(theme(0xFF0000FF.toInt()))
        editor.setHighlightActiveLine(true)
        editor.setInitialText("a\nb\nc")
        layout(editor)
        val caret = run {
          caretLeft(editor, 2)
          editor.frame.caret ?: error("no caret")
        }
        val x = editor.width - 4
        val y = (caret.centerY() * density).toInt()
        assertTrue("active line under the caret", near(draw(editor).getPixel(x, y), 0xFF0000FF.toInt()))
        editor.setDecorations(listOf(LineBackground(1, tint)), -1)
        assertTrue("line background over the active line", near(draw(editor).getPixel(x, y), tint))
      }
    }
  }

  @Test
  fun underlineMovesWithHorizontalScroll() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        val density = editor.resources.displayMetrics.density
        editor.setLineNumbers(false)
        editor.setSoftWrap(false)
        editor.setInitialText("x".repeat(200))
        layout(editor)
        editor.setDecorations(listOf(LineBackground(0, tint), Underline(185, 195, red, UnderlineStyle.Solid, 2f, 4f)), -1)
        editor.core.setSelection(195, 185)
        editor.revealSelection()
        val bitmap = draw(editor)
        assertTrue("scrolled sideways", editor.frame.scrollX > 0f)
        val caret = editor.frame.caret ?: error("no caret")
        val band = (0 until bitmap.height).filter { y -> (0 until bitmap.width).any { near(bitmap.getPixel(it, y), red) } }
        val y = band[band.size / 2]
        val left = (0 until bitmap.width).first { near(bitmap.getPixel(it, y), red) }
        assertEquals("underline starts under its first character", caret.left * density, left.toFloat(), 1.5f)
        // Just under the row top, above any glyph ink.
        assertTrue("line background stays at the left edge", near(bitmap.getPixel(1, (caret.top * density).toInt() + 1), tint))
      }
    }
  }
}
