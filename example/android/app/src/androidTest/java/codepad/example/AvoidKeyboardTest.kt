package codepad.example

import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AvoidKeyboardTest {
  @Test
  fun trackerFollowsThePropAndTheAttachment() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        assertFalse(editor.isAvoidingKeyboard)
        editor.setAvoidKeyboard(true)
        assertTrue(editor.isAvoidingKeyboard)
        val parent = editor.parent as ViewGroup
        parent.removeView(editor)
        assertFalse(editor.isAvoidingKeyboard)
        parent.addView(editor, FrameLayout.LayoutParams(600, 400))
        assertTrue(editor.isAvoidingKeyboard)
        editor.setAvoidKeyboard(false)
        assertFalse(editor.isAvoidingKeyboard)
      }
    }
  }

  @Test
  fun keyboardInsetExtendsTheScrollRangeAndLeavesTheContentSizeAlone() {
    launch().use { s ->
      val editor = s.editor()
      onMain {
        val sizes = ArrayList<Float>()
        editor.onContentSizeListener = { _, h -> sizes.add(h) }
        editor.setAvoidKeyboard(true)
        editor.setInitialText(List(50) { "line $it" }.joinToString("\n"))
        layout(editor)
        draw(editor)
        editor.scrollToLine(49, false)
        draw(editor)
        val before = editor.frame.scrollY
        val density = editor.resources.displayMetrics.density
        editor.applyKeyboardInset(300)
        editor.scrollToLine(49, false)
        draw(editor)
        assertEquals(300 / density, editor.frame.scrollY - before, 1f)
        assertEquals("content size excludes the keyboard inset", 1, sizes.size)
        editor.applyKeyboardInset(0)
        editor.scrollToLine(49, false)
        draw(editor)
        assertEquals(before, editor.frame.scrollY, 1f)
      }
    }
  }
}
