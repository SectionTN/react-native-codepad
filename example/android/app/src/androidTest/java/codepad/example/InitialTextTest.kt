package codepad.example

import androidx.test.ext.junit.runners.AndroidJUnit4
import me.sectiontn.codepad.view.ThemeColors
import me.sectiontn.codepad.view.TokenStyleColors
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class InitialTextTest {
  // A new document starts at revision 0 like the old one, so a kept snapshot passes the revision check in prepare
  // and the lines laid out from it never pick up the real one.
  @Test
  fun aNewInitialTextDropsTheSnapshotOfTheOldDocument() {
    launch().use { s ->
      val editor = s.editor()
      val heading = TokenStyleColors(0xFFFF0000.toInt(), false, false)
      onMain {
        editor.setTheme(ThemeColors.default.withTokens(mapOf("markup.heading" to heading)))
        editor.setLanguage("markdown")
        editor.setInitialText("plain text\n")
        layout(editor)
        draw(editor)
      }
      Thread.sleep(300)
      onMain {
        editor.setInitialText("# Title\n")
        draw(editor)
      }
      Thread.sleep(500)
      val bitmap = onMain { draw(editor) }
      assertTrue("heading painted after the second initial text", redPixels(bitmap, 40) > 0)
    }
  }
}
