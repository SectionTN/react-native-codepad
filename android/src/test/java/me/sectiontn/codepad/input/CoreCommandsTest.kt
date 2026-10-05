package me.sectiontn.codepad.input

import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.core.Selection
import me.sectiontn.codepad.core.TextMovement
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CoreCommandsTest {
  @Test
  fun movesAndEdits() {
    val core = EditorCore("ab cd")
    assertTrue(CoreCommands.run(core, KeyCommand.Move(TextMovement.Unit.Word, true, false)))
    assertEquals(Selection(2, 2), core.selection)
    assertTrue(CoreCommands.run(core, KeyCommand.Move(TextMovement.Unit.LineEnd, true, true)))
    assertEquals(Selection(2, 5), core.selection)
    assertTrue(CoreCommands.run(core, KeyCommand.Escape))
    assertEquals(Selection(5, 5), core.selection)
    assertTrue(CoreCommands.run(core, KeyCommand.Backspace))
    assertEquals("ab c", core.document.text())
    assertTrue(CoreCommands.run(core, KeyCommand.Undo))
    assertEquals("ab cd", core.document.text())
    assertTrue(CoreCommands.run(core, KeyCommand.Redo))
    assertEquals("ab c", core.document.text())
    assertTrue(CoreCommands.run(core, KeyCommand.SelectAll))
    assertEquals(Selection(0, 4), core.selection)
    assertTrue(CoreCommands.run(core, KeyCommand.Delete))
    assertEquals("", core.document.text())
  }

  @Test
  fun viewCommandsAreNotHandled() {
    val core = EditorCore("x")
    assertFalse(CoreCommands.run(core, KeyCommand.Vertical(1, false, false)))
    assertFalse(CoreCommands.run(core, KeyCommand.Copy))
    assertFalse(CoreCommands.run(core, KeyCommand.Cut))
    assertFalse(CoreCommands.run(core, KeyCommand.Paste))
    assertEquals("x", core.document.text())
  }

  @Test
  fun newlineAndTabs() {
    val core = EditorCore("  a")
    core.setSelection(3, 3)
    CoreCommands.run(core, KeyCommand.Newline)
    assertEquals("  a\n  ", core.document.text())
    CoreCommands.run(core, KeyCommand.Tab)
    assertEquals("  a\n      ", core.document.text())
    CoreCommands.run(core, KeyCommand.ShiftTab)
    assertEquals("  a\n  ", core.document.text())
  }
}
