package codepad.example

import android.os.SystemClock
import android.view.KeyEvent
import android.view.View
import androidx.test.ext.junit.runners.AndroidJUnit4
import me.sectiontn.codepad.core.Selection
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class HardwareKeysTest {
  private val ctrl = KeyEvent.META_CTRL_ON or KeyEvent.META_CTRL_LEFT_ON
  private val shift = KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON

  private fun key(view: View, code: Int, meta: Int = 0) {
    val now = SystemClock.uptimeMillis()
    view.dispatchKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0, meta))
    view.dispatchKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, code, 0, meta))
  }

  @Test
  fun keysMoveEditAndUndo() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("ab cd")
        key(editor, KeyEvent.KEYCODE_DPAD_RIGHT, shift)
        assertEquals(Selection(0, 1), editor.core.selection)
        key(editor, KeyEvent.KEYCODE_MOVE_END, ctrl)
        assertEquals(Selection(5, 5), editor.core.selection)
        key(editor, KeyEvent.KEYCODE_DEL)
        assertEquals("ab c", editor.core.document.text())
        key(editor, KeyEvent.KEYCODE_Z, ctrl)
        assertEquals("ab cd", editor.core.document.text())
        key(editor, KeyEvent.KEYCODE_Z, ctrl or shift)
        assertEquals("ab c", editor.core.document.text())
        key(editor, KeyEvent.KEYCODE_A, ctrl)
        assertEquals(Selection(0, 4), editor.core.selection)
        key(editor, KeyEvent.KEYCODE_X)
        assertEquals("x", editor.core.document.text())
        key(editor, KeyEvent.KEYCODE_ENTER)
        assertEquals("x\n", editor.core.document.text())
      }
    }
  }

  @Test
  fun verticalMovementKeepsTheColumn() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("abcdef\nxy\nlonger")
        layout(editor)
        editor.core.setSelection(4, 4)
        key(editor, KeyEvent.KEYCODE_DPAD_DOWN)
        assertEquals(Selection(9, 9), editor.core.selection)
        key(editor, KeyEvent.KEYCODE_DPAD_DOWN)
        assertEquals(Selection(14, 14), editor.core.selection)
        key(editor, KeyEvent.KEYCODE_DPAD_UP, shift)
        assertEquals(Selection(14, 9), editor.core.selection)
        key(editor, KeyEvent.KEYCODE_PAGE_UP)
        assertEquals(Selection(0, 0), editor.core.selection)
      }
    }
  }

  @Test
  fun readOnlyIgnoresEditingKeysOnly() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText("ab")
        editor.setReadOnly(true)
        key(editor, KeyEvent.KEYCODE_DEL)
        key(editor, KeyEvent.KEYCODE_Q)
        assertEquals("ab", editor.core.document.text())
        key(editor, KeyEvent.KEYCODE_A, ctrl)
        assertEquals(Selection(0, 2), editor.core.selection)
      }
    }
  }
}
