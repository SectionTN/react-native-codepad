import Foundation

/// Runs the commands that need only the core. Returns false for the ones that need the view.
public enum CoreCommands {
  @discardableResult
  public static func run(_ core: EditorCore, _ command: KeyCommand) -> Bool {
    switch command {
    case .move(let unit, let forward, let extend): core.move(unit, forward: forward, extend: extend)
    case .vertical, .copy, .cut, .paste: return false
    case .newline: core.insertNewline()
    case .tab: core.tab()
    case .shiftTab: core.shiftTab()
    case .backspace: core.backspace()
    case .delete: core.delete()
    case .undo: core.undo()
    case .redo: core.redo()
    case .selectAll: core.selectAll()
    case .escape: core.setSelection(anchor: core.selection.head, head: core.selection.head)
    }
    return true
  }
}
