package codepad.example

import androidx.test.ext.junit.runners.AndroidJUnit4
import me.sectiontn.codepad.core.Gap
import org.junit.Assert.assertEquals
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

  // setInitialText swaps the editor under the same layout: the size and wrap stay, the rows start over and the
  // scroll goes back to the top.
  @Test
  fun setInitialTextWhileScrolledKeepsTheMetrics() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        val sizes = ArrayList<Pair<Float, Float>>()
        editor.onContentSizeListener = { w, h -> sizes.add(w to h) }
        editor.setContentInsets(0f, 24f, 0f, 0f)
        editor.setSoftWrap(true)
        editor.setInitialText(List(1000) { "line $it" }.joinToString("\n"))
        layout(editor)
        draw(editor)
        editor.scrollToLine(500, false)
        draw(editor)
        assertTrue("scrolled, at ${editor.frame.scrollY}", editor.frame.scrollY > 0f)
        val row = (sizes[0].second - 24f) / 1000
        editor.setInitialText((listOf("word ".repeat(60)) + List(9) { "line $it" }).joinToString("\n"))
        draw(editor)
        val density = editor.resources.displayMetrics.density
        assertEquals(0f, editor.frame.scrollY, 0f)
        assertEquals("still wrapping", 600 / density, sizes.last().first, 0.5f)
        assertTrue("the long line wraps, ${sizes.last().second}", sizes.last().second > 11 * row + 24f)
      }
    }
  }

  @Test
  fun listenerReportsTheSizeWithInsetsOncePerChange() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        val sizes = ArrayList<Pair<Float, Float>>()
        editor.onContentSizeListener = { w, h -> sizes.add(w to h) }
        editor.setContentInsets(0f, 24f, 0f, 0f)
        editor.setInitialText("")
        layout(editor)
        draw(editor)
        val density = editor.resources.displayMetrics.density
        assertEquals(1, sizes.size)
        assertEquals(600 / density, sizes[0].first, 0.5f)
        // One row of a 16 dp font at 1.4 plus the bottom inset; the exact row height depends on the density rounding.
        val row = sizes[0].second - 24f
        assertTrue("one row plus the inset, got ${sizes[0].second}", row > 20f && row < 26f)
        draw(editor)
        assertEquals("a plain redraw reports nothing", 1, sizes.size)
        editor.typeText("\n")
        draw(editor)
        assertEquals(2, sizes.size)
        assertEquals(2 * row + 24f, sizes[1].second, 0.5f)
      }
    }
  }

  // A note under the last line, as a checker would open after the final line of an exercise.
  @Test
  fun gapRowsCountInTheContentHeight() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText((0 until 6).joinToString("\n") { "line $it" })
        layout(editor)
        draw(editor)
        val before = editor.frame.contentHeight
        val rh = before / 6
        editor.setDecorations(listOf(Gap(1, 2), Gap(5, 3)), -1)
        draw(editor)
        assertEquals(before + 5 * rh, editor.frame.contentHeight, 0.01f)
      }
    }
  }
}
