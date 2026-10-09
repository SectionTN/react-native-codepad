package me.sectiontn.codepad.syntax

import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import me.sectiontn.codepad.core.EditorCore
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class LanguagePackagesTest {
  private val snapshots = LinkedBlockingQueue<Snapshot>()

  // setLanguage can publish an empty document snapshot before setText does; wait for the text revision.
  private fun awaitRevision(revision: Int, grammar: String): Snapshot {
    val deadline = System.nanoTime() + 10_000_000_000L
    while (System.nanoTime() < deadline) {
      val s = snapshots.poll(1, TimeUnit.SECONDS) ?: continue
      if (s.revision == revision) return s
      s.close()
    }
    error("$grammar never parsed")
  }

  @Before
  fun setUp() = HostLib.ensure()

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
  fun everyPackageCompilesItsQueriesAndHighlightsASnippet() {
    val packages = HostLanguages.packages()
    assertTrue(packages.isNotEmpty())
    for ((id, grammar) in packages) HostLanguages.load(id, grammar)
    for ((_, grammar) in packages) {
      val lang = checkNotNull(LanguageRegistry.resolve(grammar)) { "$grammar did not load" }
      val text = checkNotNull(snippets[grammar]) { "no snippet for $grammar" }
      val core = EditorCore(text)
      val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
      engine.setLanguage(grammar)
      engine.setText(text, 1)
      val snapshot = awaitRevision(1, grammar)
      val spans = Highlighter(lang).spans(snapshot, core.document, 0, 0)
      assertTrue("$grammar paints line 0", spans[0].isNotEmpty())
      if (grammar == "markdown") assertTrue("markdown injects inline and the fence", snapshot.injected.size >= 2)
      snapshot.close()
      engine.close()
    }
  }
}
