package codepad.example

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import me.sectiontn.codepad.core.Document
import me.sectiontn.codepad.syntax.Highlighter
import me.sectiontn.codepad.syntax.LanguageProvider
import me.sectiontn.codepad.syntax.LanguageRegistry
import me.sectiontn.codepad.syntax.Snapshot
import me.sectiontn.codepad.syntax.SyntaxEngine
import org.junit.Assert.assertEquals
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
    "kv_lite" to "name = \"x\" # hi",
    "php" to "<p><?php echo \$name; ?></p>", "php_only" to "function f(\$x) { return \$x + 1; }",
    "sql" to "SELECT id FROM users WHERE id = 1; -- hi",
  )

  @Test
  fun linkedLanguagesLoadAndParse() {
    val assets = InstrumentationRegistry.getInstrumentation().targetContext.assets
    val ids = assets.list("codepad-languages")?.sorted() ?: emptyList()
    assertEquals(20, ids.size)
    for (id in ids) {
      val language = LanguageRegistry.resolve(id) ?: error("$id did not load")
      val text = checkNotNull(snippets[id]) { "no snippet for $id" }
      parse(id, text) { snapshot ->
        val spans = Highlighter(language).spans(snapshot, Document(text), 0, 0)
        assertTrue("$id paints line 0", spans[0].isNotEmpty())
      }
    }
  }

  // A provider that throws while the core resolves a fence must leave the syntax worker running.
  @Test
  fun aProviderThatThrowsInjectsNothing() {
    LanguageRegistry.register(object : LanguageProvider {
      override val id = "broken"
      override val languagePointer: Long get() = throw UnsatisfiedLinkError("no libbroken")
      override val highlights = ""
      override val injections = ""
    })
    parse("markdown", "```broken\nlet a = 1;\n```\n") { assertEquals(0, it.injected.size) }
  }

  private fun parse(id: String, text: String, check: (Snapshot) -> Unit) {
    val snapshots = LinkedBlockingQueue<Snapshot>()
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    engine.setLanguage(id)
    engine.setText(text, 0)
    // setLanguage can publish an empty document snapshot first; wait for the whole text.
    var snapshot: Snapshot
    while (true) {
      snapshot = checkNotNull(snapshots.poll(10, TimeUnit.SECONDS)) { "$id parse" }
      if (snapshot.length == text.length) break
      snapshot.close()
    }
    check(snapshot)
    snapshot.close()
    engine.close()
  }
}
