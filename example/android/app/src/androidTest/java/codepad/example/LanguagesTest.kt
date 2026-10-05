package codepad.example

import androidx.test.ext.junit.runners.AndroidJUnit4
import me.sectiontn.codepad.syntax.LanguageRegistry
import me.sectiontn.codepad.syntax.Mirror
import me.sectiontn.codepad.syntax.Parser
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LanguagesTest {
  @Test
  fun linkedLanguagesLoadAndParse() {
    for (id in listOf("javascript")) {
      val language = LanguageRegistry.resolve(id) ?: error("$id did not load")
      assertTrue("$id highlights", language.highlights.query.patternCount > 0)
      Parser().use { parser ->
        assertTrue("$id language", parser.setLanguage(language.pointer))
        Mirror().use { mirror ->
          mirror.setText("let x = 1;")
          val tree = parser.parse(null, mirror, null, 1_000_000L)
          assertNotNull("$id parse", tree)
          tree?.close()
        }
      }
    }
  }
}
