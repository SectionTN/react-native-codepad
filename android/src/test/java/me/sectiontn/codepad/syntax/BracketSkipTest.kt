package me.sectiontn.codepad.syntax

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
    val (snapshot, core) = parseCore(HostLanguages.javascript(), text)
    core.setSelection(caret, caret)
    val pair = core.bracketMatch(snapshot.pointer)
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
    val (snapshot, core) = parseCore(HostLanguages.javascript(), "(a)")
    val highlight = BracketHighlight(core)
    val first = highlight.pair(snapshot, core.document.revision, core.selection.head)
    assertArrayEquals(intArrayOf(0, 2), first)
    assertSame(first, highlight.pair(snapshot, core.document.revision, core.selection.head))
    core.setSelection(1, 1)
    assertNotSame(first, highlight.pair(snapshot, core.document.revision, core.selection.head))
    snapshot.close()
  }
}
