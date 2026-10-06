package me.sectiontn.codepad.core

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class UndoManagerTest {
  @Test
  fun historyKeepsAtMostMaxGroups() {
    val undo = UndoManager({ 0L }, maxGroups = 2)
    for (i in 0 until 3) {
      val change = Change(start = i, removed = "", inserted = "\n", revision = i + 1)
      undo.record(change, Selection.caret(i), Selection.caret(i + 1), typing = false)
    }
    assertNotNull(undo.popUndo())
    assertNotNull(undo.popUndo())
    assertNull(undo.popUndo())
  }
}
