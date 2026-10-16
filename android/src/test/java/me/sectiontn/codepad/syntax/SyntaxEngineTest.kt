package me.sectiontn.codepad.syntax

import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import me.sectiontn.codepad.core.EditorCore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class SyntaxEngineTest {
  private val snapshots = LinkedBlockingQueue<Snapshot>()

  @Before
  fun setUp() {
    HostLib.ensure()
    HostLanguages.javascript()
  }

  private fun await(): Snapshot = checkNotNull(snapshots.poll(5, TimeUnit.SECONDS))

  // The setLanguage snapshot carries the previous revision; wait for the one setText produced.
  private fun awaitRevision(revision: Int): Snapshot {
    while (true) {
      val s = await()
      if (s.revision == revision) return s
      s.close()
    }
  }

  // setLanguage can parse the still empty mirror and publish revision 0 before setText runs; skip that snapshot.
  private fun awaitText(): Snapshot {
    while (true) {
      val s = await()
      if (s.tree.rootNode().endUnit > 0) return s
      s.close()
    }
  }

  @Test
  fun publishesSnapshotsForTextAndEdits() {
    val core = EditorCore("let a = 1;")
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage("javascript")
    engine.setText(core.document.text(), core.document.revision)
    val first = awaitText()
    assertEquals(0, first.revision)
    val lang = checkNotNull(LanguageRegistry.resolve("javascript"))
    val spans = Highlighter(lang).spans(first, core.document, 0, 0)
    assertTrue(spans[0].isNotEmpty())
    first.close()

    core.replace(4, 5, "value")
    val second = await()
    assertEquals(1, second.revision)
    assertEquals(14, second.tree.rootNode().endUnit)
    second.close()
    engine.close()
  }

  @Test
  fun burstsOfEditsCoalesceIntoTheLatestRevision() {
    val core = EditorCore("")
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage("javascript")
    engine.setText("", 0)
    await().close()
    for (i in 0 until 200) core.typeText("x")
    var last: Snapshot? = null
    while (true) {
      val s = snapshots.poll(2, TimeUnit.SECONDS) ?: break
      last?.close()
      last = s
      if (s.revision == 200) break
    }
    assertEquals(200, checkNotNull(last).revision)
    last!!.close()
    engine.close()
  }

  // The blocker runs between two budget slices of the first parse, so the edit lands while a parse is outstanding.
  @Test
  fun anEditBetweenBudgetSlicesRestartsTheParse() {
    val base = "let a = 1;\n".repeat(2000)
    val core = EditorCore(base)
    val executor = Executors.newSingleThreadExecutor()
    val engine = SyntaxEngine({ it.run() }, { snapshots.add(it) }, budgetMicros = 1, executor = executor)
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage("javascript")
    engine.setText(base, core.document.revision)
    val started = CountDownLatch(1)
    val release = CountDownLatch(1)
    executor.execute {
      started.countDown()
      release.await()
    }
    started.await()
    core.replace(0, 0, " ")
    release.countDown()
    val snapshot = awaitRevision(1)
    assertEquals(shape(freshTree(" $base")), shape(snapshot.tree))
    snapshot.close()
    engine.close()
  }

  private fun freshTree(text: String): Tree {
    val lang = checkNotNull(LanguageRegistry.resolve("javascript"))
    Mirror().use { mirror ->
      mirror.setText(text)
      Parser().use { parser ->
        parser.setLanguage(lang.pointer)
        return checkNotNull(parser.parse(null, mirror, null, 0))
      }
    }
  }

  private fun shape(tree: Tree): List<String> {
    val out = ArrayList<String>()
    fun walk(n: TSNodeRef) {
      out.add("${n.type} ${n.startUnit} ${n.endUnit}")
      for (i in 0 until n.childCount) walk(n.child(i))
    }
    walk(tree.rootNode())
    return out
  }

  @Test
  fun offsetDirectiveTrimsTheTemplateStringDelimiters() {
    HostLanguages.load("html", "html")
    // The regex literal targets a never-injected language and must leave the pass and the html injection intact.
    val text = "html`<b>x</b>`; /ab+/"
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    engine.setLanguage("javascript")
    engine.setText(text, 1)
    val snapshot = awaitRevision(1)
    assertEquals("program", snapshot.tree.rootNode().type)
    assertEquals(1, snapshot.injected.size)
    assertEquals("html", snapshot.injected[0].language.id)
    assertEquals(5, snapshot.injected[0].start)
    assertEquals(text.indexOf("`;"), snapshot.injected[0].end)
    snapshot.close()
    engine.setText("html``", 2)
    val empty = awaitRevision(2)
    assertEquals("an empty template string injects nothing", 0, empty.injected.size)
    empty.close()
    engine.close()
  }

  @Test
  fun snapshotsCarryTheirLanguage() {
    HostLanguages.load("html", "html")
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    engine.setLanguage("javascript")
    engine.setText("let a = 1;", 1)
    val snapshot = awaitRevision(1)
    assertEquals("javascript", snapshot.languageId)
    snapshot.close()
    engine.setLanguage("html")
    val switched = await()
    assertEquals("html", switched.languageId)
    switched.close()
    engine.close()
  }

  // A snapshot can land after the view detached and closed the engine; handing it back must not throw.
  @Test
  fun releaseDoesNotThrowAfterClose() {
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    engine.setLanguage("javascript")
    engine.setText("let a = 1;", 1)
    val first = awaitRevision(1)
    engine.setText("let b = 2;", 2)
    val second = awaitRevision(2)
    engine.release(first)
    engine.close()
    engine.release(second)
  }

  // A first parse split by the budget re-queues itself; after close() shut the executor down that used to kill the process.
  @Test
  fun closeDuringABudgetSplitParseDoesNotThrow() {
    val thrown = AtomicReference<Throwable?>(null)
    val executor = Executors.newSingleThreadExecutor { r ->
      Thread(r, "codepad-syntax-test").apply { setUncaughtExceptionHandler { _, e -> thrown.set(e) } }
    }
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) }, budgetMicros = 1L, executor = executor)
    engine.setLanguage("javascript")
    engine.setText((0 until 20000).joinToString("\n") { "const v$it = f($it) + g(\"$it\");" }, 1)
    engine.close()
    assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS))
    assertEquals(null, thrown.get())
  }

  // A region list that spans the file, or one that misses the edited line, would re-query the page or paint it stale.
  @Test
  fun anEditInsideAFunctionLeavesTheNextStatementUntouched() {
    val text = "function f() {\n  return 1;\n}\nlet g = 2;\n"
    val core = EditorCore(text)
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage("javascript")
    engine.setText(text, 0)
    val first = awaitText()
    assertEquals(-1, first.basedOn)
    first.close()
    core.replace(25, 25, "2")
    val second = awaitRevision(1)
    assertEquals(0, second.basedOn)
    assertTrue(meetsLine(second.changed, 15, 26))
    assertFalse(meetsLine(second.changed, 29, 39))
    second.close()
    engine.close()
  }

  // The declarator's name keeps the function style unless the snapshot names its line.
  @Test
  fun aChangedValueKindCoversTheDeclaratorName() {
    val core = EditorCore("const f =\n  function() {};\n")
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage("javascript")
    engine.setText(core.document.text(), 0)
    awaitText().close()
    core.replace(12, 25, "1")
    val snapshot = awaitRevision(1)
    assertTrue(meetsLine(snapshot.changed, 0, 9))
    snapshot.close()
    engine.close()
  }

  // The blocker holds the syntax thread while two edits queue, so one pass covers both.
  @Test
  fun editsBeforeAPassCompletesAccumulateTheirRegions() {
    val text = "let a = 1;\nlet b = 2;\nlet c = 3;\n"
    val core = EditorCore(text)
    val executor = Executors.newSingleThreadExecutor()
    val engine = SyntaxEngine({ it.run() }, { snapshots.add(it) }, executor = executor)
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage("javascript")
    engine.setText(text, 0)
    awaitText().close()
    val started = CountDownLatch(1)
    val release = CountDownLatch(1)
    executor.execute {
      started.countDown()
      release.await()
    }
    started.await()
    core.replace(8, 9, "9")
    core.replace(30, 31, "9")
    release.countDown()
    val snapshot = awaitRevision(2)
    assertEquals(0, snapshot.basedOn)
    assertTrue(meetsLine(snapshot.changed, 0, 10))
    assertTrue(meetsLine(snapshot.changed, 22, 32))
    assertFalse(meetsLine(snapshot.changed, 11, 21))
    snapshot.close()
    engine.close()
  }

  // The reference tree used to live in the injection pass; a language without one published no regions at all.
  @Test
  fun aLanguageWithoutInjectionsStillReportsRegions() {
    HostLanguages.load("json", "json")
    val core = EditorCore("{\"a\": 1,\n \"b\": 2}\n")
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage("json")
    engine.setText(core.document.text(), 0)
    awaitText().close()
    core.replace(15, 16, "3")
    val snapshot = awaitRevision(1)
    assertEquals(0, snapshot.basedOn)
    assertTrue(meetsLine(snapshot.changed, 9, 17))
    snapshot.close()
    engine.close()
  }
}
