package codepad.example

import androidx.test.ext.junit.runners.AndroidJUnit4
import me.sectiontn.codepad.core.Gap
import me.sectiontn.codepad.input.KeyCommand
import me.sectiontn.codepad.view.CodeEditorView
import me.sectiontn.codepad.view.GapRect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GapLayoutTest {
  private val text = (0 until 6).joinToString("\n") { "line $it" }

  // Caret rects span the whole row, so their top is the row top, in dp.
  private fun caretTop(editor: CodeEditorView, line: Int): Float {
    val offset = editor.core.document.lineStart(line)
    editor.core.setSelection(offset, offset)
    draw(editor)
    return (editor.frame.caret ?: error("no caret on line $line")).top
  }

  private fun rowHeight(editor: CodeEditorView): Float {
    draw(editor)
    return (editor.frame.caret ?: error("no caret")).height()
  }

  @Test
  fun gapsPushLaterLinesDownByWholeRows() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setLineNumbers(false)
        editor.setInitialText(text)
        layout(editor)
        val rh = rowHeight(editor)
        editor.setDecorations(listOf(Gap(1, 2)), -1)
        val top1 = caretTop(editor, 1)
        val top2 = caretTop(editor, 2)
        assertEquals(3 * rh, top2 - top1, 0.01f)
        val g = editor.gapRect(1) ?: error("no gap rect")
        assertEquals(top1 + rh, g.top, 0.01f)
        assertEquals(2 * rh, g.height(), 0.01f)
        assertEquals(editor.width / editor.resources.displayMetrics.density, g.width(), 0.01f)
      }
    }
  }

  @Test
  fun listenerReportsMovesAndRemovals() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText(text)
        layout(editor)
        val rh = rowHeight(editor)
        val events = ArrayList<List<GapRect>>()
        editor.onGapLayoutListener = { events.add(it) }
        editor.setDecorations(listOf(Gap(2, 1)), -1)
        draw(editor)
        assertEquals(1, events.size)
        val first = events[0].single()
        assertEquals(2, first.line)
        editor.core.replace(0, 0, "\n")
        draw(editor)
        assertEquals(2, events.size)
        val moved = events[1].single()
        assertEquals(3, moved.line)
        assertEquals(first.rect.top + rh, moved.rect.top, 0.01f)
        draw(editor)
        assertEquals("no event without a change", 2, events.size)
        val doc = editor.core.document
        editor.core.replace(doc.lineStart(3), doc.lineStart(4), "")
        draw(editor)
        assertEquals(3, events.size)
        assertTrue(events[2].isEmpty())
      }
    }
  }

  @Test
  fun arrowDownSkipsTheGap() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText(text)
        layout(editor)
        editor.setDecorations(listOf(Gap(1, 2)), -1)
        val start = editor.core.document.lineStart(1)
        editor.core.setSelection(start, start)
        draw(editor)
        editor.perform(KeyCommand.Vertical(1, false, false))
        assertEquals(2, editor.core.document.lineAt(editor.core.selection.head))
      }
    }
  }
}
