package me.sectiontn.codepad.syntax

import java.io.File
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import me.sectiontn.codepad.core.Document
import org.junit.Assert.assertEquals
import org.junit.BeforeClass
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** Every sample's spans against tests/highlight/<id>.spans; CODEPAD_RECORD_HIGHLIGHT=1 rewrites them. */
@RunWith(Parameterized::class)
class HighlightGoldenTest(private val id: String) {
  companion object {
    private val dir: File
      get() = File(System.getProperty("codepad.vectorsDir") ?: "../tests/vectors").resolveSibling("highlight")

    @JvmStatic
    @Parameterized.Parameters(name = "{0}")
    fun ids(): List<String> = dir.listFiles { f -> f.name.endsWith(".txt") }?.map { it.nameWithoutExtension }?.sorted()
      ?: error("no highlight sources in ${dir.absolutePath}")

    @JvmStatic
    @BeforeClass
    fun loadAll() {
      HostLib.ensure()
      for ((pkg, grammar) in HostLanguages.packages()) HostLanguages.load(pkg, grammar)
    }

    /** One line per run: line, start column, end column, capture name. */
    fun render(doc: Document, spans: Array<IntArray>): String = buildString {
      for ((line, runs) in spans.withIndex()) {
        var i = 0
        while (i < runs.size) {
          append(line).append(' ').append(runs[i]).append(' ').append(runs[i + 1]).append(' ')
          append(StyleTable.name(runs[i + 2])).append('\n')
          i += 3
        }
      }
    }
  }

  @Test
  fun spansMatchTheGolden() {
    val text = dir.resolve("$id.txt").readText()
    val snapshots = LinkedBlockingQueue<Snapshot>()
    val engine = SyntaxEngine(postToMain = { it.run() }, onSnapshot = { snapshots.add(it) })
    engine.setLanguage(id)
    engine.setText(text, 0)
    // setLanguage can publish an empty document snapshot first; wait for the whole text.
    var snapshot: Snapshot
    while (true) {
      snapshot = checkNotNull(snapshots.poll(10, TimeUnit.SECONDS)) { "$id never parsed" }
      if (snapshot.tree.rootNode().endUnit == text.length) break
      snapshot.close()
    }
    val doc = Document(text)
    val lang = checkNotNull(LanguageRegistry.resolve(id))
    val actual = render(doc, Highlighter(lang).spans(snapshot, doc, 0, doc.lineCount - 1))
    snapshot.close()
    engine.close()
    val golden = dir.resolve("$id.spans")
    if (System.getenv("CODEPAD_RECORD_HIGHLIGHT") == "1") golden.writeText(actual) else assertEquals(golden.readText(), actual)
  }
}
