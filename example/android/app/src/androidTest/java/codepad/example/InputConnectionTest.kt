package codepad.example

import android.text.InputType
import android.view.KeyEvent
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import androidx.test.ext.junit.runners.AndroidJUnit4
import me.sectiontn.codepad.core.Range
import me.sectiontn.codepad.view.InputMethodBridge
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class InputConnectionTest {
  @Test
  fun editorInfoFollowsSuggestionsAndReadOnly() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("abc")
        editor.core.setSelection(1, 2)
        val info = EditorInfo()
        assertNotNull(editor.onCreateInputConnection(info))
        assertEquals(
          InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS,
          info.inputType,
        )
        assertEquals(
          EditorInfo.IME_FLAG_NO_ENTER_ACTION or EditorInfo.IME_FLAG_NO_FULLSCREEN or EditorInfo.IME_FLAG_NO_EXTRACT_UI,
          info.imeOptions,
        )
        assertEquals(1, info.initialSelStart)
        assertEquals(2, info.initialSelEnd)
        editor.setSuggestions(InputMethodBridge.Suggestions.On)
        val on = EditorInfo()
        editor.onCreateInputConnection(on)
        assertTrue(on.inputType and InputType.TYPE_TEXT_FLAG_AUTO_CORRECT != 0)
        editor.setSuggestions(InputMethodBridge.Suggestions.ForceOff)
        val forced = EditorInfo()
        editor.onCreateInputConnection(forced)
        assertTrue(forced.inputType and InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD != 0)
        assertTrue(editor.onCheckIsTextEditor())
        editor.setReadOnly(true)
        assertNull(editor.onCreateInputConnection(EditorInfo()))
        assertFalse(editor.onCheckIsTextEditor())
      }
    }
  }

  @Test
  fun typingThroughTheConnection() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("")
        val ic = editor.onCreateInputConnection(EditorInfo()) ?: error("no connection")
        ic.beginBatchEdit()
        ic.commitText("x = ", 1)
        ic.setComposingText("ni", 1)
        ic.endBatchEdit()
        assertEquals("x = ni", editor.core.document.text())
        assertEquals(Range(4, 6), editor.ime.composing)
        ic.commitText("ni", 1)
        assertNull(editor.ime.composing)
        ic.deleteSurroundingText(1, 0)
        assertEquals("x = n", editor.core.document.text())
        assertEquals("x = n", ic.getTextBeforeCursor(10, 0).toString())
      }
    }
  }

  @Test
  fun composingUnderlineDraws() {
    launch().use { s ->
      val editor = s.editor()
      val (plain, composed) = onMain {
        editor.setInitialText("abc")
        layout(editor)
        val before = draw(editor)
        // Two draws of the same state match, so a difference below comes from the underline, not a blink.
        assertTrue(before.sameAs(draw(editor)))
        val ic = editor.onCreateInputConnection(EditorInfo()) ?: error("no connection")
        ic.setComposingRegion(0, 3)
        before to draw(editor)
      }
      assertFalse(plain.sameAs(composed))
    }
  }

  // Unmount can drop a view still in the window with a composition open. Freeing the core right away made the
  // keyboard's next call and the detach throw on a closed core.
  @Test
  fun aViewDroppedMidCompositionKeepsItsCoreUntilItLeavesTheWindow() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("abc")
        editor.requestFocus()
        val connection = checkNotNull(editor.onCreateInputConnection(EditorInfo()))
        connection.setComposingText("xy", 1)
        editor.close()
        assertTrue(connection.finishComposingText())
        (editor.parent as ViewGroup).removeView(editor)
      }
    }
  }

  // The layout lives as long as the core. A dropped view still in the window relays out on a keyboard edit that
  // widens the gutter, and draws, until it leaves.
  @Test
  fun aDroppedViewStillDrawsUntilItLeavesTheWindow() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("abc")
        layout(editor)
        draw(editor)
        editor.requestFocus()
        val connection = checkNotNull(editor.onCreateInputConnection(EditorInfo()))
        editor.close()
        assertTrue(connection.commitText("\n".repeat(9), 1))
        draw(editor)
        (editor.parent as ViewGroup).removeView(editor)
        assertFalse(connection.commitText("x", 1))
      }
    }
  }

  // A keyboard call queued before the dropped view left the window runs after its core was freed.
  @Test
  fun aKeyboardCallAfterTheCoreIsFreedDoesNothing() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("abc")
        editor.requestFocus()
        val connection = checkNotNull(editor.onCreateInputConnection(EditorInfo()))
        editor.close()
        (editor.parent as ViewGroup).removeView(editor)
        assertFalse(connection.commitText("x", 1))
        assertEquals("", connection.getTextBeforeCursor(10, 0).toString())
        assertFalse(connection.beginBatchEdit())
        assertFalse(connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_A)))
        connection.closeConnection()
      }
    }
  }

  // A view that left the window before the drop frees its core in close(), and its connection must know.
  @Test
  fun aViewClosedAfterItLeftTheWindowStopsItsConnection() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("abc")
        editor.requestFocus()
        val connection = checkNotNull(editor.onCreateInputConnection(EditorInfo()))
        (editor.parent as ViewGroup).removeView(editor)
        editor.close()
        assertEquals("", connection.getTextBeforeCursor(10, 0).toString())
      }
    }
  }
}
