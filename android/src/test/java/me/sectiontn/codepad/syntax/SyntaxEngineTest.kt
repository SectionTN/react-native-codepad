package me.sectiontn.codepad.syntax

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

  @Test
  fun injectionsParseEmbeddedLanguages() {
    val core = EditorCore("const q = /ab+/; const s = `x`;")
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    engine.setLanguage("javascript")
    engine.setText(core.document.text(), 0)
    val snapshot = await()
    // regex and template injections target languages that are not installed, so nothing is injected,
    // but the pass must complete without errors and leave the host tree intact.
    assertEquals(0, snapshot.injected.size)
    assertEquals("program", snapshot.tree.rootNode().type)
    snapshot.close()
    engine.close()
  }

  @Test
  fun offsetDirectiveTrimsTheTemplateStringDelimiters() {
    HostLanguages.load("html", "html")
    val text = "html`<b>x</b>`"
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    engine.setLanguage("javascript")
    engine.setText(text, 1)
    val snapshot = awaitRevision(1)
    assertEquals(1, snapshot.injected.size)
    assertEquals("html", snapshot.injected[0].language.id)
    assertEquals(5, snapshot.injected[0].ranges[0])
    assertEquals(text.length - 1, snapshot.injected[0].ranges[1])
    snapshot.close()
    engine.close()
  }

  @Test
  fun emptyTemplateStringInjectsNothing() {
    HostLanguages.load("html", "html")
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    engine.setLanguage("javascript")
    engine.setText("html``", 1)
    val snapshot = awaitRevision(1)
    assertEquals(0, snapshot.injected.size)
    snapshot.close()
    engine.close()
  }
}
