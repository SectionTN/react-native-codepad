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

  // A measure call that clamps the scroll moves it in a draw where nothing else scrolled. The listener hears of it.
  @Test
  fun aClampInTheMeasureCallReachesTheScrollListener() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setInitialText((0 until 100).joinToString("\n") { "line $it" })
        layout(editor)
        draw(editor)
        val viewport = viewportOf(editor)
        viewport.measured(98, 30)
        viewport.measured(99, 30)
        viewport.scrollTo(0, viewport.maxScrollY)
        val before = viewport.scrollY
        var heard = -1f
        editor.onScrollListener = { heard = it.scrollY }
        draw(editor)
        assertTrue("the measure call clamped the scroll, scrollY ${viewport.scrollY}", viewport.scrollY < before)
        assertEquals(editor.frame.scrollY, heard, 0.01f)
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

  // The lines an animated scroll passes get their wrapped heights on the way, which moves the target line down.
  // The scroll still ends with that line at the top.
  @Test
  fun anAnimatedScrollToLineWithWrapEndsAtTheLine() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        editor.setSoftWrap(true)
        editor.setInitialText((0 until 600).joinToString("\n") { "line $it " + "word ".repeat(20) })
        layout(editor)
        draw(editor)
        editor.scrollToLine(400, true)
        assertTrue("the scroll is animating", viewportOf(editor).scrollY < viewportOf(editor).rowHeight)
        // The rows the passed lines would get from the draws on the way.
        for (line in 1 until 400) viewportOf(editor).measured(line, 3)
      }
      SystemClock.sleep(1000)
      onMain {
        draw(editor)
        val viewport = viewportOf(editor)
        assertEquals(400, viewport.firstVisibleLine())
        assertEquals(viewport.rowStart(400) * viewport.rowHeight, viewport.scrollY)
      }
    }
  }
}
