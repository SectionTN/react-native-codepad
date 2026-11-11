package me.sectiontn.codepad.core

import me.sectiontn.codepad.syntax.CoreNative

/** The core's undo history for one editor. The keyboard session groups its edits through it. */
class UndoManager internal constructor(private val core: EditorCore) {
  /** True when the selection moved for a reason other than an edit. The next typed unit starts a new group. */
  var selectionDirty: Boolean
    get() = CoreNative.editorSelectionDirty(core.handle())
    set(value) = CoreNative.editorSetSelectionDirty(core.handle(), value)

  /** Opens a group at the current selection. Groups nest. */
  fun beginGroup() = CoreNative.editorBeginGroup(core.handle())

  fun endGroup() = CoreNative.editorEndGroup(core.handle())
}
