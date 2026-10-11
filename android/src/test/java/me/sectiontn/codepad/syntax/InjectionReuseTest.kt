package me.sectiontn.codepad.syntax

import java.util.concurrent.CountDownLatch
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

  private fun awaitRevision(revision: Int): Snapshot {
    while (true) {
      val s = checkNotNull(snapshots.poll(5, TimeUnit.SECONDS))
      if (s.revision == revision) return s
      s.close()
    }
  }

  private fun start(language: String, text: String): Pair<EditorCore, SyntaxEngine> {
    val core = EditorCore(text)
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage(language)
    engine.setText(text, 0)
    return core to engine
  }

  // A language whose provider blocks the syntax thread on first resolve until the gate opens.
  private fun registerSlow(reached: CountDownLatch, gate: CountDownLatch) {
    LanguageRegistry.register(object : LanguageProvider {
      override val id = "slow"
      override val languagePointer: Long
        get() {
          reached.countDown()
          gate.await(5, TimeUnit.SECONDS)
          return HostLib.language("javascript")
        }
      override val highlights = ""
      override val injections = ""
    })
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
  fun editsOutsideInjectionsCarryTheirTrees() {
    val text = "<script>let a = 1;</script>\n<style>.a { color: red; }</style>\n<p>x</p>"
    val (core, engine) = start("html", text)
    val first = awaitParsed()
    assertEquals(2, first.stats.freshInjections)
    assertEquals(0, first.stats.reusedInjections)
    assertEquals(0, first.stats.carriedInjections)
    first.close()

    core.replace(text.indexOf("x</p>"), text.indexOf("x</p>") + 1, "xy")
    val second = awaitParsed()
    assertEquals(0, second.stats.freshInjections)
    assertEquals(0, second.stats.reusedInjections)
    assertEquals(2, second.stats.carriedInjections)
    second.close()

    core.replace(text.indexOf("1;"), text.indexOf("1;") + 1, "12")
    val third = awaitParsed()
    assertEquals(0, third.stats.freshInjections)
    assertEquals(1, third.stats.reusedInjections)
    assertEquals(1, third.stats.carriedInjections)
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
    assertEquals(1, second.stats.reusedInjections)
    assertEquals(fresh - 1, second.stats.carriedInjections)
    second.close()

    engine.setLanguage("markdown")
    val third = awaitParsed()
    assertEquals(0, third.stats.reusedInjections)
    assertEquals(0, third.stats.carriedInjections)
    assertEquals(fresh, third.stats.freshInjections)
    third.close()
    engine.close()
  }

  @Test
  fun changingTheFenceLanguageRetiresTheOldTree() {
    val text = "# T\n\nfirst para\n\n```js\nlet a = 1;\n```\n"
    val (core, engine) = start("markdown", text)
    val first = awaitParsed()
    val count = first.injected.size
    assertTrue(first.injected.any { it.language.id == "javascript" })
    first.close()
    val at = text.indexOf("```js") + 3
    core.replace(at, at + 2, "css")
    val second = awaitParsed()
    assertEquals(count, second.injected.size)
    assertTrue(second.injected.none { it.language.id == "javascript" })
    assertEquals(text.indexOf("let") + 1, second.injected.single { it.language.id == "css" }.start)
    assertEquals(1, second.stats.freshInjections)
    assertEquals(0, second.stats.reusedInjections)
    assertEquals(count - 1, second.stats.carriedInjections)
    second.close()
    engine.close()
  }

  @Test
  fun removingTheClosingFenceExtendsTheInjection() {
    val text = "# T\n\n```js\nlet a = 1;\n```\n\nafter para\n"
    val (core, engine) = start("markdown", text)
    val first = awaitParsed()
    assertEquals(3, first.injected.size)
    first.close()
    val close = text.lastIndexOf("```")
    core.replace(close, close + 4, "")
    val second = awaitParsed()
    assertEquals(2, second.injected.size)
    val js = second.injected.single { it.language.id == "javascript" }
    assertTrue(js.end > core.document.text().indexOf("after"))
    assertEquals(1, second.stats.freshInjections + second.stats.reusedInjections)
    assertEquals(1, second.stats.carriedInjections)
    second.close()
    engine.close()
  }

  @Test
  fun pastedFencesAppear() {
    val text = "# T\n\nfirst para\n\nsecond para\n"
    val (core, engine) = start("markdown", text)
    val first = awaitParsed()
    assertEquals(3, first.injected.size)
    first.close()
    core.replace(text.length, text.length, "\n```js\nlet a = 1;\n```\n\n```css\n.a {}\n```\n")
    val second = awaitParsed()
    assertEquals(5, second.injected.size)
    assertEquals(2, second.stats.freshInjections)
    assertTrue(second.stats.reusedInjections <= 1)
    assertTrue(second.stats.carriedInjections >= 2)
    second.close()
    engine.close()
  }

  @Test
  fun deletingAFenceRetiresItsTree() {
    val text = "# T\n\n```js\nlet a = 1;\n```\n\nafter para\n"
    val (core, engine) = start("markdown", text)
    val first = awaitParsed()
    assertEquals(3, first.injected.size)
    first.close()
    core.replace(text.indexOf("```js"), text.indexOf("after"), "")
    val second = awaitParsed()
    assertEquals(2, second.injected.size)
    assertTrue(second.injected.none { it.language.id == "javascript" })
    assertEquals(0, second.stats.freshInjections)
    assertTrue(second.stats.reusedInjections <= 1)
    assertTrue(second.stats.carriedInjections >= 1)
    second.close()
    engine.close()
  }

  @Test
  fun aBurstInsideAFenceKeepsOneTree() {
    val text = "# T\n\n```js\nlet a = 1;\n```\n\nafter para\n"
    val (core, engine) = start("markdown", text)
    val first = awaitParsed()
    val end0 = first.injected.single { it.language.id == "javascript" }.end
    first.close()
    val at = text.indexOf("1;")
    for (i in 0 until 20) core.replace(at + i, at + i, "x")
    val last = awaitRevision(core.document.revision)
    assertEquals(3, last.injected.size)
    assertEquals(end0 + 20, last.injected.single { it.language.id == "javascript" }.end)
    last.close()
    engine.close()
  }

  // The slow fence is inserted after the first pass, so pass two is the first to resolve it and blocks there.
  @Test
  fun aCancelledPassDoesNotAdvanceTheReferenceTree() {
    val reached = CountDownLatch(1)
    val gate = CountDownLatch(1)
    registerSlow(reached, gate)
    val code = (0 until 200).joinToString("\n") { "function f$it(a, b) { return a + b * $it; }" }
    val text = "# T\n\n```javascript\nlet b = 1;\n```\n"
    val (core, engine) = start("markdown", text)
    val first = awaitParsed()
    assertEquals(2, first.injected.size)
    first.close()
    core.replace(5, 5, "```slow\n$code\n```\n\n")
    assertTrue(reached.await(5, TimeUnit.SECONDS))
    val one = core.document.text().indexOf("let b = 1;") + 8
    core.replace(one, one + 1, "2")
    gate.countDown()
    val snapshot = awaitRevision(2)
    assertTrue(snapshot.injected.any { it.language.id == "slow" })
    assertEquals(1, snapshot.stats.freshInjections)
    assertEquals(1, snapshot.stats.reusedInjections)
    snapshot.close()
    engine.close()
  }

  // A key during the injection pass cancels it; the snapshot it was building must not go out half filled.
  @Test
  fun cancelledInjectionPassPublishesNoPartialSnapshot() {
    val reached = CountDownLatch(1)
    val gate = CountDownLatch(1)
    registerSlow(reached, gate)
    // The fence is long enough for the parser to reach a cancellation check once the edit lands.
    val code = (0 until 200).joinToString("\n") { "function f$it(a, b) { return a + b * $it; }" }
    val text = "# T\n\nfirst para\n\nsecond para\n\n```slow\n$code\n```\n"
    val core = EditorCore(text)
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage("markdown")
    engine.setText(text, 0)
    assertTrue(reached.await(5, TimeUnit.SECONDS))
    core.replace(text.indexOf("second"), text.indexOf("second"), "the ")
    gate.countDown()
    val snapshot = awaitParsed()
    assertEquals(4, snapshot.injected.size)
    snapshot.close()
    engine.close()
  }
}
