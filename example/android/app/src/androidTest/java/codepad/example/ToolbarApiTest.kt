package codepad.example

import android.view.ViewGroup
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import me.sectiontn.codepad.core.Selection
import me.sectiontn.codepad.core.TextMovement
import me.sectiontn.codepad.input.KeyCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ToolbarApiTest {
  @Test
  fun verticalMovesKeepTheGoalXAndStopAtTheEdges() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("abcdef\nab\nabcdef")
        layout(editor)
        draw(editor)
        editor.core.setSelection(5, 5)
        editor.perform(KeyCommand.Vertical(1, false, false))
        assertEquals(Selection(9, 9), editor.core.selection)
        editor.perform(KeyCommand.Vertical(1, false, false))
        assertEquals(Selection(15, 15), editor.core.selection)
        editor.perform(KeyCommand.Vertical(1, true, false))
        assertEquals("page down past the end clamps to the document end", Selection(16, 16), editor.core.selection)
        editor.perform(KeyCommand.Vertical(-1, true, true))
        assertEquals("page up extends from the document end", 16, editor.core.selection.anchor)
        assertEquals(0, editor.core.document.lineAt(editor.core.selection.head))
      }
    }
  }

  @Test
  fun typeTextTakesTheKeyboardPath() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("")
        editor.typeText("(")
        assertEquals("()", editor.core.document.text())
        assertEquals(Selection(1, 1), editor.core.selection)
        editor.typeText(")")
        assertEquals("()", editor.core.document.text())
        assertEquals(Selection(2, 2), editor.core.selection)
        editor.typeText("{")
        editor.typeText("\n")
        assertEquals("(){\n    \n}", editor.core.document.text())
        editor.setText("", false)
        editor.typeText("ab")
        editor.core.undo()
        assertEquals("two typed chars undo as one group", "", editor.core.document.text())
        editor.typeText("[")
        editor.perform(KeyCommand.Backspace)
        assertEquals("backspace removes the empty pair", "", editor.core.document.text())
        editor.perform(KeyCommand.Backspace)
        editor.perform(KeyCommand.Delete)
        assertEquals("", editor.core.document.text())
      }
    }
  }

  @Test
  fun readOnlyIgnoresEditsAndStillMoves() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("ab")
        editor.setReadOnly(true)
        editor.typeText("x")
        editor.perform(KeyCommand.Backspace)
        editor.perform(KeyCommand.Delete)
        assertEquals("ab", editor.core.document.text())
        editor.perform(KeyCommand.Move(TextMovement.Unit.Char, true, true))
        assertEquals(Selection(0, 1), editor.core.selection)
      }
    }
  }

  @Test
  fun runOnMainRunsWhileDetached() {
    launch().use { s ->
      val editor = s.editor()
      var ran = false
      onMain {
        (editor.parent as ViewGroup).removeView(editor)
        editor.runOnMain { ran = true }
      }
      InstrumentationRegistry.getInstrumentation().waitForIdleSync()
      assertTrue("the block ran without a window", ran)
    }
  }
}
