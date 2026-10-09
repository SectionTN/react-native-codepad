package codepad.example

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import me.sectiontn.codepad.core.Document
import me.sectiontn.codepad.syntax.Highlighter
import me.sectiontn.codepad.syntax.LanguageRegistry
import me.sectiontn.codepad.syntax.Mirror
import me.sectiontn.codepad.syntax.Parser
import me.sectiontn.codepad.syntax.Snapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LanguagesTest {
  // One line per grammar; every line paints at least one span through highlights.scm.
  private val snippets = mapOf(
    "javascript" to "const x = 1; // hi", "typescript" to "const x: number = 1;",
    "tsx" to "const a = <div className=\"x\">{1}</div>;", "json" to "{\"a\": [1, true, null]}",
    "html" to "<p class=\"x\">hi</p>", "css" to ".a { color: red; }",
    "markdown" to "# Title\n\nSome *text*\n\n```js\nlet a = 1;\n```\n", "markdown_inline" to "Some *text* and `code`",
    "python" to "def f(x):\n    return x + 1", "java" to "class A { int x = 1; }",
    "kotlin" to "fun main() { val x = 1 }", "swift" to "let x = 1 // hi",
    "c" to "int main(void) { return 0; }", "rust" to "fn main() { let x = 1; }",
    "go" to "package main\nfunc main() { x := 1 }", "yaml" to "a: 1\nb: [x, y]",
  )

  @Test
  fun linkedLanguagesLoadAndParse() {
    val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    val ids = assets.list("codepad-languages")?.sorted() ?: emptyList()
    assertEquals(16, ids.size)
    for (id in ids) {
      val language = LanguageRegistry.resolve(id) ?: error("$id did not load")
      assertTrue("$id highlights", language.highlights.query.patternCount > 0)
      val text = checkNotNull(snippets[id]) { "no snippet for $id" }
      Parser().use { parser ->
        assertTrue("$id language", parser.setLanguage(language.pointer))
        Mirror().use { mirror ->
          mirror.setText(text)
          val tree = parser.parse(null, mirror, null, 1_000_000L)
          assertNotNull("$id parse", tree)
          val snapshot = Snapshot(0, checkNotNull(tree), emptyList())
          val spans = Highlighter(language).spans(snapshot, Document(text), 0, 0)
          assertTrue("$id paints line 0", spans[0].isNotEmpty())
          snapshot.close()
        }
      }
    }
  }
}
