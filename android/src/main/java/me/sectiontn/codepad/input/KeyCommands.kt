package me.sectiontn.codepad.input

import android.view.KeyEvent
import me.sectiontn.codepad.core.TextMovement

/** What a hardware key asks the editor to do. [edits] marks the ones a read only editor ignores. */
sealed class KeyCommand(val edits: Boolean) {
  data class Move(val unit: TextMovement.Unit, val forward: Boolean, val extend: Boolean) : KeyCommand(false)

  /** [direction] is -1 for up and 1 for down; [page] moves by a viewport instead of a row. */
  data class Vertical(val direction: Int, val page: Boolean, val extend: Boolean) : KeyCommand(false)

  object Newline : KeyCommand(true)
  object Tab : KeyCommand(true)
  object ShiftTab : KeyCommand(true)
  object Backspace : KeyCommand(true)
  object Delete : KeyCommand(true)
  object Undo : KeyCommand(true)
  object Redo : KeyCommand(true)
  object Cut : KeyCommand(true)
  object Paste : KeyCommand(true)
  object SelectAll : KeyCommand(false)
  object Copy : KeyCommand(false)
  object Escape : KeyCommand(false)
}

object KeyCommands {
  fun map(keyCode: Int, metaState: Int): KeyCommand? {
    if (metaState and (KeyEvent.META_ALT_ON or KeyEvent.META_META_ON) != 0) return null
    val ctrl = metaState and KeyEvent.META_CTRL_ON != 0
    val shift = metaState and KeyEvent.META_SHIFT_ON != 0
    val horizontal = if (ctrl) TextMovement.Unit.Word else TextMovement.Unit.Char
    return when (keyCode) {
      KeyEvent.KEYCODE_DPAD_LEFT -> KeyCommand.Move(horizontal, false, shift)
      KeyEvent.KEYCODE_DPAD_RIGHT -> KeyCommand.Move(horizontal, true, shift)
      KeyEvent.KEYCODE_DPAD_UP -> KeyCommand.Vertical(-1, false, shift)
      KeyEvent.KEYCODE_DPAD_DOWN -> KeyCommand.Vertical(1, false, shift)
      KeyEvent.KEYCODE_PAGE_UP -> KeyCommand.Vertical(-1, true, shift)
      KeyEvent.KEYCODE_PAGE_DOWN -> KeyCommand.Vertical(1, true, shift)
      KeyEvent.KEYCODE_MOVE_HOME -> KeyCommand.Move(if (ctrl) TextMovement.Unit.DocStart else TextMovement.Unit.LineStart, false, shift)
      KeyEvent.KEYCODE_MOVE_END -> KeyCommand.Move(if (ctrl) TextMovement.Unit.DocEnd else TextMovement.Unit.LineEnd, true, shift)
      KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> KeyCommand.Newline
      KeyEvent.KEYCODE_TAB -> if (ctrl) null else if (shift) KeyCommand.ShiftTab else KeyCommand.Tab
      KeyEvent.KEYCODE_DEL -> KeyCommand.Backspace
      KeyEvent.KEYCODE_FORWARD_DEL -> KeyCommand.Delete
      KeyEvent.KEYCODE_ESCAPE -> KeyCommand.Escape
      KeyEvent.KEYCODE_COPY -> KeyCommand.Copy
      KeyEvent.KEYCODE_CUT -> KeyCommand.Cut
      KeyEvent.KEYCODE_PASTE -> KeyCommand.Paste
      KeyEvent.KEYCODE_Z -> if (!ctrl) null else if (shift) KeyCommand.Redo else KeyCommand.Undo
      KeyEvent.KEYCODE_Y -> if (ctrl && !shift) KeyCommand.Redo else null
      KeyEvent.KEYCODE_A -> if (ctrl && !shift) KeyCommand.SelectAll else null
      KeyEvent.KEYCODE_C -> if (ctrl && !shift) KeyCommand.Copy else null
      KeyEvent.KEYCODE_X -> if (ctrl && !shift) KeyCommand.Cut else null
      KeyEvent.KEYCODE_V -> if (ctrl && !shift) KeyCommand.Paste else null
      else -> null
    }
  }
}
