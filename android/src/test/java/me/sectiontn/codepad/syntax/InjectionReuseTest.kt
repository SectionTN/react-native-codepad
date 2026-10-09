package me.sectiontn.codepad.syntax

import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import me.sectiontn.codepad.core.EditorCore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class InjectionReuseTest {
  private val snapshots = LinkedBlockingQueue<Snapshot>()

  @Before
  fun setUp() {
    HostLib.ensure()
    for ((id, grammar) in listOf("javascript" to "javascript", "css" to "css", "html" to "html", "markdown" to "markdown", "markdown" to "markdown_inline")) {
      HostLanguages.load(id, grammar)
    }
  }

  // setLanguage can publish an empty document snapshot before setText does; skip it.
  private fun awaitParsed(): Snapshot {
    while (true) {
      val s = checkNotNull(snapshots.poll(5, TimeUnit.SECONDS))
      if (s.tree.rootNode().endUnit > 0) return s
      s.close()
    }
  }

  private fun styleAt(spans: IntArray, column: Int): String? {
    var i = 0
    while (i < spans.size) {
      if (column >= spans[i] && column < spans[i + 1]) return StyleTable.name(spans[i + 2])
      i += 3
    }
    return null
  }

  @Test
  fun htmlReusesInjectedTreesAcrossEdits() {
    val text = "<script>let a = 1;</script>\n<style>.a { color: red; }</style>\n<p>x</p>"
    val core = EditorCore(text)
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage("html")
    engine.setText(text, 0)
    val first = awaitParsed()
    assertEquals(2, first.stats.freshInjections)
    assertEquals(0, first.stats.reusedInjections)
    first.close()

    core.replace(text.indexOf("x</p>"), text.indexOf("x</p>") + 1, "xy")
    val second = awaitParsed()
    assertEquals(0, second.stats.freshInjections)
    assertEquals(2, second.stats.reusedInjections)
    second.close()

    core.replace(text.indexOf("1;"), text.indexOf("1;") + 1, "12")
    val third = awaitParsed()
    assertEquals(0, third.stats.freshInjections)
    assertEquals(2, third.stats.reusedInjections)
    val html = checkNotNull(LanguageRegistry.resolve("html"))
    val spans = Highlighter(html).spans(third, core.document, 0, 1)
    assertEquals("keyword", styleAt(spans[0], 8))
    assertEquals("property", styleAt(spans[1], 12))
    third.close()
    engine.close()
  }

  @Test
  fun markdownParagraphsReuseTheirTreesAndUnknownFencesInjectNothing() {
    val text = "# T\n\nfirst para\n\nsecond para\n\n```JS\nlet a = 1;\n```\n\n```ruby\nputs 1\n```\n"
    val core = EditorCore(text)
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage("markdown")
    engine.setText(text, 0)
    val first = awaitParsed()
    val fresh = first.stats.freshInjections
    assertTrue("inline nodes and the js fence, got $fresh", fresh >= 3)
    assertTrue(first.injected.any { it.language.id == "javascript" })
    assertTrue(first.injected.none { it.language.id == "ruby" })
    val markdown = checkNotNull(LanguageRegistry.resolve("markdown"))
    assertTrue(Highlighter(markdown).spans(first, core.document, 0, 0)[0].isNotEmpty())
    first.close()

    core.replace(text.indexOf("second para") + 11, text.indexOf("second para") + 11, "!")
    val second = awaitParsed()
    assertEquals(0, second.stats.freshInjections)
    assertEquals(fresh, second.stats.reusedInjections)
    second.close()

    engine.setLanguage("markdown")
    val third = awaitParsed()
    assertEquals(0, third.stats.reusedInjections)
    assertEquals(fresh, third.stats.freshInjections)
    third.close()
    engine.close()
  }
}
