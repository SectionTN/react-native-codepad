package codepad.example

import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import me.sectiontn.codepad.view.ThemeColors
import me.sectiontn.codepad.view.TokenStyleColors
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KeyFrameHighlightTest {
  // A painter that re-queries only the edited line keeps the declarator's name in the function style.
  @Test
  fun aChangedValueKindRecolorsTheDeclaratorNameWithTheSnapshot() {
    launch().use { s ->
      val editor = s.editor()
      val function = TokenStyleColors(0xFFFF0000.toInt(), false, false)
      onMain {
        editor.setTheme(ThemeColors.default.withTokens(mapOf("function" to function)))
        editor.setLanguage("javascript")
        editor.setInitialText("const f =\n  function() {};\n")
        layout(editor)
        draw(editor)
      }
      Thread.sleep(300)
      val before = onMain { draw(editor) }
      assertTrue("the name painted in the function style", redPixels(before, 80) > 0)
      onMain {
        editor.core.replace(12, 25, "1")
        draw(editor)
      }
      Thread.sleep(300)
      val after = onMain { draw(editor) }
      assertEquals("the name painted in the variable style", 0, redPixels(after, 80))
    }
  }

  // Without the fallback a key paints its whole line plain until the snapshot lands; Markdown 2k misses 41 keys in 60.
  @Test
  fun aFrameBeforeTheSnapshotKeepsTheEditedLinesColors() {
    launch().use { s ->
      val editor = s.editor()
      val number = TokenStyleColors(0xFFFF0000.toInt(), false, false)
      onMain {
        editor.setTheme(ThemeColors.default.withTokens(mapOf("number" to number)))
        editor.setLanguage("javascript")
        editor.setInitialText("const f = 1;\n")
        layout(editor)
        draw(editor)
      }
      Thread.sleep(300)
      assertTrue("the number painted", redPixels(onMain { draw(editor) }, 80) > 0)
      val before = onMain {
        editor.core.replace(12, 12, " ")
        draw(editor)
      }
      Thread.sleep(300)
      assertTrue("the number painted after the snapshot", redPixels(onMain { draw(editor) }, 80) > 0)
      assertTrue("the number kept its color in the frame before the snapshot", redPixels(before, 80) > 0)
    }
  }

  // Enter before a colored token used to keep the whole line's spans on the shortened line and crash in setSpan.
  @Test
  fun aNewlineBeforeAColoredTokenMovesItsColorToTheNewLine() {
    launch().use { s ->
      val editor = s.editor()
      val number = TokenStyleColors(0xFFFF0000.toInt(), false, false)
      onMain {
        editor.setTheme(ThemeColors.default.withTokens(mapOf("number" to number)))
        editor.setLanguage("javascript")
        editor.setInitialText("const f = 1;\n")
        layout(editor)
        draw(editor)
      }
      Thread.sleep(300)
      assertTrue("the number painted", redPixels(onMain { draw(editor) }, 80) > 0)
      val before = onMain {
        editor.core.setSelection(6, 6)
        editor.typeText("\n")
        draw(editor)
      }
      Thread.sleep(300)
      assertTrue("the number painted after the snapshot", redPixels(onMain { draw(editor) }, 80) > 0)
      assertTrue("the number kept its color in the frame before the snapshot", redPixels(before, 80) > 0)
    }
  }

  // Both documents start at revision 0: the old text's snapshot, posted before setInitialText, would pass the
  // revision check and paint the old number's color inside the new text's string.
  @Test
  fun snapshotFromBeforeSetInitialTextNeverPaints() {
    launch().use { s ->
      val editor = s.editor()
      val number = TokenStyleColors(0xFFFF0000.toInt(), false, false)
      val release = CountDownLatch(1)
      onMain {
        editor.setTheme(ThemeColors.default.withTokens(mapOf("number" to number)))
        editor.setLanguage("python")
        editor.setInitialText("x = 1\n")
        layout(editor)
        // The old snapshot waits in the main queue, and the held worker cannot parse the new text yet.
        val worker = checkNotNull(editor.engine).executor
        worker.submit {}.get()
        worker.execute { release.await() }
        editor.setInitialText("{\"ab\": \"cd\"}\n")
      }
      Thread.sleep(300)
      val image = onMain { draw(editor) }
      release.countDown()
      assertEquals("the old text's number color painted over the new text", 0, redPixels(image, 80))
      Thread.sleep(300)
      assertEquals("the new text has no number", 0, redPixels(onMain { draw(editor) }, 80))
    }
  }
}
