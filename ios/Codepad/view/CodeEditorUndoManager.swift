import Foundation

/// Foundation's undo manager over the core's groups: Cmd+Z, the edit menu and shake to undo all land here.
final class CodeEditorUndoManager: Foundation.UndoManager {
  private weak var editor: CodeEditorView?

  init(editor: CodeEditorView) {
    self.editor = editor
    super.init()
  }

  override var canUndo: Bool { editor?.core.canUndo ?? false }
  override var canRedo: Bool { editor?.core.canRedo ?? false }

  override func undo() {
    MainActor.assumeIsolated { editor?.undo() }
  }

  override func redo() {
    MainActor.assumeIsolated { editor?.redo() }
  }
}
