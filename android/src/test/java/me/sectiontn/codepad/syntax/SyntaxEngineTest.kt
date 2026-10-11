package me.sectiontn.codepad.syntax

import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import me.sectiontn.codepad.core.EditorCore
import org.junit.Assert.assertEquals
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

  @Test
  fun publishesSnapshotsForTextAndEdits() {
    val core = EditorCore("let a = 1;")
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    core.onChange = { change, _ -> engine.edit(change, SyntaxEngine.pointsFor(core.document, change)) }
    engine.setLanguage("javascript")
    engine.setText(core.document.text(), core.document.revision)
    // setLanguage can publish an empty document snapshot before setText does; skip it.
    var first = await()
    while (first.tree.rootNode().endUnit == 0) {
      first.close()
      first = await()
    }
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
    assertEquals(5, snapshot.injected[0].ranges[0])
    assertEquals(text.indexOf("`;"), snapshot.injected[0].ranges[1])
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
}
