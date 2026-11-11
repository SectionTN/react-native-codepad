package me.sectiontn.codepad.syntax

import me.sectiontn.codepad.core.BracketMatcher
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

  private fun pairAt(text: String, caret: Int): IntArray? {
    val lang = HostLanguages.javascript()
    val (snapshot, doc) = parseSnapshot(lang, text)
    val pair = BracketMatcher.match(doc, caret, SpanWindow(snapshot, Highlighter(lang), doc)::skip)
    snapshot.close()
    return pair
  }

  @Test
  fun bracketsInsideStringsAndCommentsAreSkipped() {
    val text = "a = (\"(\" + b) // )"
    assertArrayEquals(intArrayOf(4, 12), pairAt(text, 4))
    assertArrayEquals(intArrayOf(1, 8), pairAt("f( // )\n)", 1))
  }

  @Test
  fun pairIsCachedUntilTheCaretMoves() {
    val lang = HostLanguages.javascript()
    val core = EditorCore("(a)")
    val (snapshot, _) = parseSnapshot(lang, core.document.text())
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
