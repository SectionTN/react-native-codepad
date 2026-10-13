package codepad.example

import androidx.test.ext.junit.runners.AndroidJUnit4
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
}
