package me.sectiontn.codepad.input

import me.sectiontn.codepad.core.EditorCore

/** Runs the commands that need only the core. Returns false for the ones that need the view. */
object CoreCommands {
  fun run(core: EditorCore, command: KeyCommand): Boolean {
    when (command) {
      is KeyCommand.Move -> core.move(command.unit, command.forward, command.extend)
      is KeyCommand.Vertical, KeyCommand.Copy, KeyCommand.Cut, KeyCommand.Paste -> return false
      KeyCommand.Newline -> core.insertNewline()
      KeyCommand.Tab -> core.tab()
      KeyCommand.ShiftTab -> core.shiftTab()
      KeyCommand.Backspace -> core.backspace()
      KeyCommand.Delete -> core.delete()
      KeyCommand.Undo -> core.undo()
      KeyCommand.Redo -> core.redo()
      KeyCommand.SelectAll -> core.selectAll()
      KeyCommand.Escape -> core.setSelection(core.selection.head, core.selection.head)
    }
    return true
  }
}
