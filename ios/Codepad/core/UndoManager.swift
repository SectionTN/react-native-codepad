import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// The core's undo history for one editor. The keyboard sessions group their edits through it.
final class UndoManager {
  private let document: Document

  init(_ document: Document) {
    self.document = document
  }

  var canUndo: Bool { cp_editor_history(document.handle) & 1 != 0 }
  var canRedo: Bool { cp_editor_history(document.handle) & 2 != 0 }

  /// True when the selection moved for a reason other than an edit. The next typed unit starts a new group.
  var selectionDirty: Bool {
    get { cp_editor_selection_dirty(document.handle) != 0 }
    set { cp_editor_set_selection_dirty(document.handle, newValue ? 1 : 0) }
  }

  /// Opens a group at the current selection. Groups nest.
  func beginGroup() {
    cp_editor_begin_group(document.handle)
  }

  func endGroup() {
    cp_editor_end_group(document.handle)
  }
}
