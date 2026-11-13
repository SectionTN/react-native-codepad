package codepad.example

import android.os.SystemClock
import android.view.KeyEvent
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ScrollTest {
  @Test
  fun insetChangesKeepTheHorizontalScroll() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setLineNumbers(false)
        editor.setInitialText("x".repeat(200))
        layout(editor)
        draw(editor)
        val now = SystemClock.uptimeMillis()
        editor.dispatchKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MOVE_END, 0))
        draw(editor)
        val before = editor.frame.scrollX
        assertTrue("the caret reveal scrolled right, scrollX $before", before > 0f)
        editor.setContentInsets(0f, 24f, 0f, 0f)
        draw(editor)
        assertEquals("scrollX after the inset change", before, editor.frame.scrollX, 0.5f)
      }
    }
  }

  // An API edit that removes the lines under the scroll clamps it in the core. The scroll listener must hear of it,
  // or the host keeps the old offset.
  @Test
  fun anEditThatClampsTheScrollReachesTheScrollListener() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText((0 until 200).joinToString("\n") { "line $it" })
        layout(editor)
        draw(editor)
        editor.scrollToLine(199, false)
        draw(editor)
        val before = editor.frame.scrollY
        assertTrue("scrolled to the end, scrollY $before", before > 0f)
        var heard = -1f
        editor.onScrollListener = { heard = it.scrollY }
        val doc = editor.core.document
        editor.core.replace(doc.lineStart(20), doc.length, "")
        draw(editor)
        assertTrue("the edit clamped the scroll, scrollY ${editor.frame.scrollY}", editor.frame.scrollY < before)
        assertEquals(editor.frame.scrollY, heard, 0.01f)
      }
    }
  }
}
