package me.sectiontn.codepad.input

import android.view.KeyEvent
import me.sectiontn.codepad.core.TextMovement
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class KeyCommandsTest {
  private val ctrl = KeyEvent.META_CTRL_ON
  private val shift = KeyEvent.META_SHIFT_ON

  @Test
  fun arrowsMoveByCharWordAndRow() {
    assertEquals(KeyCommand.Move(TextMovement.Unit.Char, true, false), KeyCommands.map(KeyEvent.KEYCODE_DPAD_RIGHT, 0))
    assertEquals(KeyCommand.Move(TextMovement.Unit.Word, false, true), KeyCommands.map(KeyEvent.KEYCODE_DPAD_LEFT, ctrl or shift))
    assertEquals(KeyCommand.Vertical(-1, false, true), KeyCommands.map(KeyEvent.KEYCODE_DPAD_UP, shift))
    assertEquals(KeyCommand.Vertical(1, false, false), KeyCommands.map(KeyEvent.KEYCODE_DPAD_DOWN, ctrl))
    assertEquals(KeyCommand.Vertical(1, true, false), KeyCommands.map(KeyEvent.KEYCODE_PAGE_DOWN, 0))
    assertEquals(KeyCommand.Vertical(-1, true, true), KeyCommands.map(KeyEvent.KEYCODE_PAGE_UP, shift))
    assertEquals(KeyCommand.Move(TextMovement.Unit.LineStart, false, false), KeyCommands.map(KeyEvent.KEYCODE_MOVE_HOME, 0))
    assertEquals(KeyCommand.Move(TextMovement.Unit.LineEnd, true, true), KeyCommands.map(KeyEvent.KEYCODE_MOVE_END, shift))
    assertEquals(KeyCommand.Move(TextMovement.Unit.DocStart, false, false), KeyCommands.map(KeyEvent.KEYCODE_MOVE_HOME, ctrl))
    assertEquals(KeyCommand.Move(TextMovement.Unit.DocEnd, true, true), KeyCommands.map(KeyEvent.KEYCODE_MOVE_END, ctrl or shift))
  }

  @Test
  fun editingShortcuts() {
    assertEquals(KeyCommand.Undo, KeyCommands.map(KeyEvent.KEYCODE_Z, ctrl))
    assertEquals(KeyCommand.Redo, KeyCommands.map(KeyEvent.KEYCODE_Z, ctrl or shift))
    assertEquals(KeyCommand.Redo, KeyCommands.map(KeyEvent.KEYCODE_Y, ctrl))
    assertEquals(KeyCommand.SelectAll, KeyCommands.map(KeyEvent.KEYCODE_A, ctrl))
    assertEquals(KeyCommand.Copy, KeyCommands.map(KeyEvent.KEYCODE_C, ctrl))
    assertEquals(KeyCommand.Cut, KeyCommands.map(KeyEvent.KEYCODE_X, ctrl))
    assertEquals(KeyCommand.Paste, KeyCommands.map(KeyEvent.KEYCODE_V, ctrl))
    assertEquals(KeyCommand.Copy, KeyCommands.map(KeyEvent.KEYCODE_COPY, 0))
    assertEquals(KeyCommand.Tab, KeyCommands.map(KeyEvent.KEYCODE_TAB, 0))
    assertEquals(KeyCommand.ShiftTab, KeyCommands.map(KeyEvent.KEYCODE_TAB, shift))
    assertEquals(KeyCommand.Newline, KeyCommands.map(KeyEvent.KEYCODE_ENTER, shift))
    assertEquals(KeyCommand.Newline, KeyCommands.map(KeyEvent.KEYCODE_NUMPAD_ENTER, 0))
    assertEquals(KeyCommand.Backspace, KeyCommands.map(KeyEvent.KEYCODE_DEL, 0))
    assertEquals(KeyCommand.Delete, KeyCommands.map(KeyEvent.KEYCODE_FORWARD_DEL, 0))
    assertEquals(KeyCommand.Escape, KeyCommands.map(KeyEvent.KEYCODE_ESCAPE, 0))
  }

  @Test
  fun unmappedKeys() {
    assertNull(KeyCommands.map(KeyEvent.KEYCODE_Z, 0))
    assertNull(KeyCommands.map(KeyEvent.KEYCODE_A, ctrl or shift))
    assertNull(KeyCommands.map(KeyEvent.KEYCODE_TAB, ctrl))
    assertNull(KeyCommands.map(KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.META_ALT_ON))
    assertNull(KeyCommands.map(KeyEvent.KEYCODE_V, ctrl or KeyEvent.META_META_ON))
    assertNull(KeyCommands.map(KeyEvent.KEYCODE_Q, 0))
  }
}
