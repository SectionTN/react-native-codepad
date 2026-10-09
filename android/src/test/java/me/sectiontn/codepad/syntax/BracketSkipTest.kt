package me.sectiontn.codepad.syntax

import me.sectiontn.codepad.core.BracketMatcher
import me.sectiontn.codepad.core.Document
import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.view.BracketHighlight
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertSame
import org.junit.Before
import org.junit.Test

class BracketSkipTest {
  @Before
  fun setUp() = HostLib.ensure()

  private fun snapshotOf(lang: LoadedLanguage, doc: Document): Snapshot {
    val parser = Parser()
    parser.setLanguage(lang.pointer)
    val mirror = Mirror()
    mirror.setText(doc.text())
    val tree = checkNotNull(parser.parse(null, mirror, null, 0))
    mirror.close()
    parser.close()
    return Snapshot(doc.revision, tree, emptyList(), "javascript")
  }

  private fun pairAt(text: String, caret: Int): IntArray? {
    val lang = HostLanguages.javascript()
    val doc = Document(text)
    val snapshot = snapshotOf(lang, doc)
    val pair = BracketMatcher.match(doc, caret, SpanWindow(snapshot, Highlighter(lang), doc)::skip)
    snapshot.close()
    return pair
  }

  @Test
  fun bracketsInsideStringsAndCommentsAreSkipped() {
    val text = "a = (\"(\" + b) // )"
    assertArrayEquals(intArrayOf(4, 12), pairAt(text, 4))
  }

  @Test
  fun unmatchedOpenerSeesThroughAComment() {
    assertArrayEquals(intArrayOf(1, 8), pairAt("f( // )\n)", 1))
  }

  @Test
  fun pairIsCachedUntilTheCaretMoves() {
    val lang = HostLanguages.javascript()
    val core = EditorCore("(a)")
    val snapshot = snapshotOf(lang, core.document)
    val highlighter = Highlighter(lang)
    val highlight = BracketHighlight(core)
    val first = highlight.pair(snapshot, highlighter)
    assertArrayEquals(intArrayOf(0, 2), first)
    assertSame(first, highlight.pair(snapshot, highlighter))
    core.setSelection(1, 1)
    assertNotSame(first, highlight.pair(snapshot, highlighter))
    snapshot.close()
  }
}
