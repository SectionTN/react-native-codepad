package me.sectiontn.codepad.input

import me.sectiontn.codepad.core.Change
import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.core.Range
import me.sectiontn.codepad.core.Selection
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ImeSessionTest {
  private fun session(text: String = "", caret: Int = text.length): Pair<EditorCore, ImeSession> {
    val core = EditorCore(text)
    core.setSelection(caret, caret)
    return core to ImeSession(core)
  }

  @Test
  fun commitInsertsAtTheCaret() {
    val (core, ime) = session("ab", 1)
    assertTrue(ime.commitText("X", 1))
    assertEquals("aXb", core.document.text())
    assertEquals(Selection(2, 2), core.selection)
    assertNull(ime.composing)
  }

  @Test
  fun composingGrowsByOneCharEdits() {
    val (core, ime) = session()
    val changes = ArrayList<Change>()
    core.onChange = { c, _ -> changes.add(c) }
    ime.setComposingText("h", 1)
    ime.setComposingText("he", 1)
    ime.setComposingText("hel", 1)
    assertEquals("hel", core.document.text())
    assertEquals(Range(0, 3), ime.composing)
    assertEquals(listOf("h", "e", "l"), changes.map { it.inserted })
    assertEquals(Selection(3, 3), core.selection)
  }

  @Test
  fun composingReplacesOnlyTheChangedMiddle() {
    val (core, ime) = session()
    ime.setComposingText("niho n", 1)
    val changes = ArrayList<Change>()
    core.onChange = { c, _ -> changes.add(c) }
    ime.setComposingText("niho N", 1)
    assertEquals(1, changes.size)
    assertEquals(5, changes[0].start)
    assertEquals("n", changes[0].removed)
    assertEquals("N", changes[0].inserted)
    ime.setComposingText("niho N", 1)
    assertEquals(1, changes.size)
  }

  @Test
  fun composingNeverSplitsASurrogatePair() {
    val (core, ime) = session()
    val smile = String(Character.toChars(0x1F600))
    val wink = String(Character.toChars(0x1F609))
    ime.setComposingText(smile, 1)
    val changes = ArrayList<Change>()
    core.onChange = { c, _ -> changes.add(c) }
    ime.setComposingText(wink, 1)
    assertEquals(smile, changes[0].removed)
    assertEquals(wink, changes[0].inserted)
    assertEquals(wink, core.document.text())
  }

  @Test
  fun commitEndsTheCompositionAsOneUndoStep() {
    val (core, ime) = session("x ", 2)
    ime.setComposingText("h", 1)
    ime.setComposingText("he", 1)
    ime.commitText("hey", 1)
    assertEquals("x hey", core.document.text())
    assertNull(ime.composing)
    assertEquals(Selection(5, 5), core.selection)
    assertTrue(core.undo())
    assertEquals("x ", core.document.text())
    assertEquals(Selection(2, 2), core.selection)
    assertFalse(core.canUndo)
  }

  @Test
  fun caretPositionRule() {
    val (core, ime) = session("abcd", 2)
    ime.commitText("XY", 0)
    assertEquals("abXYcd", core.document.text())
    assertEquals(Selection(2, 2), core.selection)
    ime.setComposingText("Q", -1)
    assertEquals("abQXYcd", core.document.text())
    assertEquals(Selection(1, 1), core.selection)
    ime.setComposingText("QQ", 2)
    assertEquals("abQQXYcd", core.document.text())
    assertEquals(Selection(5, 5), core.selection)
  }

  @Test
  fun singleCharCommitsUseTheTypingPipeline() {
    val (core, ime) = session()
    ime.commitText("(", 1)
    assertEquals("()", core.document.text())
    assertEquals(Selection(1, 1), core.selection)
    ime.commitText("\n", 1)
    assertEquals("(\n    \n)", core.document.text())
    assertEquals(Selection(6, 6), core.selection)
  }

  @Test
  fun multiCharCommitIsOneInsert() {
    val (core, ime) = session("a", 1)
    val changes = ArrayList<Change>()
    core.onChange = { c, _ -> changes.add(c) }
    ime.commitText("hello ", 1)
    assertEquals(1, changes.size)
    assertEquals("ahello ", core.document.text())
    assertEquals(Selection(7, 7), core.selection)
  }

  @Test
  fun composingRegionMarksExistingText() {
    val (core, ime) = session("hello world", 3)
    ime.setComposingRegion(0, 5)
    assertEquals(Range(0, 5), ime.composing)
    assertEquals(Selection(3, 3), core.selection)
    ime.setComposingText("help", 1)
    assertEquals("help world", core.document.text())
    assertEquals(Selection(4, 4), core.selection)
    ime.setComposingRegion(9, 2)
    assertEquals(Range(2, 9), ime.composing)
    ime.setComposingRegion(4, 4)
    assertNull(ime.composing)
  }

  @Test
  fun finishKeepsTheText() {
    val (core, ime) = session()
    ime.setComposingText("ab", 1)
    assertTrue(ime.finishComposingText())
    assertNull(ime.composing)
    assertEquals("ab", core.document.text())
  }

  @Test
  fun applyingIsSetDuringSessionEdits() {
    val (core, ime) = session()
    var seen = false
    core.onChange = { _, _ -> seen = ime.applying }
    ime.commitText("a", 1)
    assertTrue(seen)
    assertFalse(ime.applying)
  }

  @Test
  fun deleteSurroundingTextSkipsTheComposingText() {
    val (core, ime) = session("abcdef", 3)
    ime.setComposingRegion(2, 4)
    assertTrue(ime.deleteSurroundingText(1, 1))
    assertEquals("acdf", core.document.text())
    assertEquals(Range(1, 3), ime.composing)
    assertEquals(Selection(2, 2), core.selection)
  }

  @Test
  fun deletesClampToTheDocumentAsOneUndoStep() {
    val (core, ime) = session("abcdef", 3)
    ime.deleteSurroundingText(10, 10)
    assertEquals("", core.document.text())
    assertTrue(core.undo())
    assertEquals("abcdef", core.document.text())
    assertFalse(core.canUndo)
  }

  @Test
  fun singleBackspaceDeletesAnEmptyPairAndCoalesces() {
    val (core, ime) = session()
    ime.commitText("(", 1)
    ime.deleteSurroundingText(1, 0)
    assertEquals("", core.document.text())
    ime.commitText("a", 1)
    ime.commitText("b", 1)
    ime.commitText("c", 1)
    ime.deleteSurroundingText(1, 0)
    ime.deleteSurroundingText(1, 0)
    assertEquals("a", core.document.text())
    assertTrue(core.undo())
    assertEquals("abc", core.document.text())
  }

  @Test
  fun deleteInCodePointsWalksSurrogatePairs() {
    val smile = String(Character.toChars(0x1F600))
    val (core, ime) = session("a" + smile + "b", 3)
    assertTrue(ime.deleteSurroundingTextInCodePoints(1, 1))
    assertEquals("a", core.document.text())
    assertEquals(Selection(1, 1), core.selection)
  }

  @Test
  fun textWindows() {
    val (core, ime) = session("hello world", 5)
    assertEquals("llo", ime.textBeforeCursor(3))
    assertEquals(" wo", ime.textAfterCursor(3))
    assertEquals("hello", ime.textBeforeCursor(100))
    assertNull(ime.selectedText())
    core.setSelection(2, 7)
    assertEquals("llo w", ime.selectedText())
    assertEquals(ImeSession.Window("ello worl", 1, 6, 1), ime.window(1, 3))
    assertEquals(ImeSession.Window("hello world", 2, 7, 0), ime.window(50, 50))
  }

  @Test
  fun batchDepthNests() {
    val (_, ime) = session()
    assertTrue(ime.beginBatchEdit())
    ime.beginBatchEdit()
    assertTrue(ime.endBatchEdit())
    assertFalse(ime.endBatchEdit())
    assertFalse(ime.endBatchEdit())
    assertEquals(0, ime.batchDepth)
  }

  @Test
  fun externalChangesMapOrDropTheComposition() {
    val (core, ime) = session("xx", 2)
    ime.setComposingText("ab", 1)
    assertFalse(ime.onExternalChange(core.replace(0, 1, "YY")))
    assertEquals(Range(3, 5), ime.composing)
    assertFalse(ime.onExternalChange(core.replace(5, 5, "z")))
    assertEquals(Range(3, 5), ime.composing)
    assertTrue(ime.onExternalChange(core.replace(4, 4, "!")))
    assertNull(ime.composing)
    assertFalse(ime.onExternalChange(core.replace(0, 0, "q")))
  }

  @Test
  fun selectionFromTheImeClampsAndKeepsComposing() {
    val (core, ime) = session("abc", 0)
    ime.setComposingRegion(0, 3)
    assertTrue(ime.setSelection(9, 1))
    assertEquals(Selection(3, 1), core.selection)
    assertEquals(Range(0, 3), ime.composing)
    assertEquals("abc", ime.composingText())
    ime.beginBatchEdit()
    ime.reset()
    assertNull(ime.composing)
    assertNull(ime.composingText())
    assertEquals(0, ime.batchDepth)
  }
}
