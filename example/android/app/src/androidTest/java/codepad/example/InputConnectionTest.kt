package codepad.example

import android.text.InputType
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
        assertEquals(Range(4, 6), editor.composing)
        ic.commitText("ni", 1)
        assertNull(editor.composing)
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
        val ic = editor.onCreateInputConnection(EditorInfo()) ?: error("no connection")
        ic.setComposingRegion(0, 3)
        before to draw(editor)
      }
      assertFalse(plain.sameAs(composed))
    }
  }
}
