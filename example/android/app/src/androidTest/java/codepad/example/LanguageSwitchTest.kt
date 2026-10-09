package codepad.example

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import me.sectiontn.codepad.view.ThemeColors
import me.sectiontn.codepad.view.TokenStyleColors
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LanguageSwitchTest {
  private fun redPixels(bitmap: Bitmap, rows: Int): Int {
    var n = 0
    for (y in 0 until minOf(rows, bitmap.height)) {
      for (x in 0 until bitmap.width) {
        val p = bitmap.getPixel(x, y)
        if ((p shr 16 and 0xff) > 200 && (p shr 8 and 0xff) < 80 && (p and 0xff) < 80) n++
      }
    }
    return n
  }

  // A picker sets the text first and the language a frame later, so a frame draws between the switch and
  // the new grammar's snapshot; the heading must still end up painted by the markdown query.
  @Test
  fun aFrameBetweenTheSwitchAndTheNewSnapshotDoesNotStickToTheOldGrammar() {
    launch().use { s ->
      val editor = s.editor()
      val heading = TokenStyleColors(0xFFFF0000.toInt(), false, false)
      onMain {
        editor.setTheme(ThemeColors.default.withTokens(mapOf("markup.heading" to heading)))
        editor.setLanguage("javascript")
        editor.setInitialText("let a = 1;")
        layout(editor)
        draw(editor)
      }
      Thread.sleep(300)
      onMain { editor.setText("# Title\n\nplain text\n", false) }
      Thread.sleep(300)
      onMain {
        editor.setLanguage("markdown")
        draw(editor)
      }
      Thread.sleep(500)
      val bitmap = onMain { draw(editor) }
      assertTrue("heading painted by the markdown grammar", redPixels(bitmap, 40) > 0)
    }
  }
}
