package me.sectiontn.codepad.core

private const val MAX_GROUPS = 1000

class UndoManager(private val clock: () -> Long) {
  enum class Kind { Insert, Backspace, Other }

  class Group(val selectionBefore: Selection) {
    val changes = ArrayList<Change>()
    var selectionAfter: Selection = selectionBefore
    var time: Long = 0
    var kind: Kind = Kind.Other
    var typing: Boolean = false
  }

  private val undoStack = ArrayDeque<Group>()
  private val redoStack = ArrayDeque<Group>()
  private var open: Group? = null
  private var depth = 0

  /** True when the selection moved for a reason other than an edit. The next typed character starts a new group. */
  var selectionDirty = false

  val canUndo: Boolean get() = undoStack.isNotEmpty()
  val canRedo: Boolean get() = redoStack.isNotEmpty()

  fun beginGroup(selection: Selection) {
    if (depth++ == 0) open = Group(selection)
  }

  fun endGroup(selection: Selection) {
    if (--depth > 0) return
    val group = open ?: return
    open = null
    if (group.changes.isNotEmpty()) {
      group.selectionAfter = selection
      group.time = clock()
      push(group)
    }
  }

  fun record(change: Change, before: Selection, after: Selection, typing: Boolean) {
    redoStack.clear()
    val now = clock()
    val explicit = open
    if (explicit != null) {
      explicit.changes.add(change)
      explicit.selectionAfter = after
      explicit.time = now
      return
    }
    val kind = kindOf(change, typing)
    val last = undoStack.lastOrNull()
    if (last != null && typing && last.typing && !selectionDirty && canMerge(last, change, kind, before, now)) {
      merge(last, change, kind)
      last.selectionAfter = after
      last.time = now
      selectionDirty = false
      return
    }
    val group = Group(before)
    group.changes.add(change)
    group.selectionAfter = after
    group.time = now
    group.kind = kind
    group.typing = typing
    push(group)
    selectionDirty = false
  }

  fun amendSelectionAfter(selection: Selection) {
    (open ?: undoStack.lastOrNull())?.selectionAfter = selection
  }

  fun popUndo(): Group? = undoStack.removeLastOrNull()?.also { redoStack.addLast(it) }

  fun popRedo(): Group? = redoStack.removeLastOrNull()?.also { undoStack.addLast(it) }

  fun clear() {
    undoStack.clear()
    redoStack.clear()
    open = null
    depth = 0
  }

  private fun push(group: Group) {
    undoStack.addLast(group)
    while (undoStack.size > MAX_GROUPS) undoStack.removeFirst()
  }

  private fun kindOf(c: Change, typing: Boolean): Kind = when {
    !typing -> Kind.Other
    c.removed.isEmpty() && c.inserted.length == 1 && c.inserted[0] != '\n' -> Kind.Insert
    c.inserted.isEmpty() && c.removed.length == 1 && c.removed[0] != '\n' -> Kind.Backspace
    else -> Kind.Other
  }

  private fun canMerge(last: Group, c: Change, kind: Kind, before: Selection, now: Long): Boolean {
    if (kind == Kind.Other || last.kind != kind) return false
    if (now - last.time >= 1000) return false
    if (before != last.selectionAfter) return false
    val prev = last.changes[last.changes.size - 1]
    return if (kind == Kind.Insert) c.start == prev.newEnd else c.end == prev.start
  }

  private fun merge(last: Group, c: Change, kind: Kind) {
    val prev = last.changes.removeAt(last.changes.size - 1)
    val merged = if (kind == Kind.Insert) {
      Change(prev.start, prev.removed, prev.inserted + c.inserted, c.revision)
    } else {
      Change(c.start, c.removed + prev.removed, prev.inserted, c.revision)
    }
    last.changes.add(merged)
  }
}
