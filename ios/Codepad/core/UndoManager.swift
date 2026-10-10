import Foundation

/// Groups of changes for undo and redo. Typed units coalesce into the last group inside a one second window.
public final class UndoManager {
  public enum Kind {
    case insert
    case backspace
    case other
  }

  public final class Group {
    public let selectionBefore: Selection
    public var changes: [Change] = []
    public var selectionAfter: Selection
    var time: Int64 = 0
    var kind: Kind = .other
    var typing = false

    init(selectionBefore: Selection) {
      self.selectionBefore = selectionBefore
      selectionAfter = selectionBefore
    }
  }

  private let clock: () -> Int64
  private let maxGroups: Int
  private var undoStack: [Group] = []
  private var redoStack: [Group] = []
  private var open: Group? = nil
  private var depth = 0

  /// True when the selection moved for a reason other than an edit. The next typed character starts a new group.
  public var selectionDirty = false

  public init(clock: @escaping () -> Int64, maxGroups: Int = 1000) {
    self.clock = clock
    self.maxGroups = maxGroups
  }

  public var canUndo: Bool { !undoStack.isEmpty }
  public var canRedo: Bool { !redoStack.isEmpty }

  public func beginGroup(_ selection: Selection) {
    if depth == 0 { open = Group(selectionBefore: selection) }
    depth += 1
  }

  public func endGroup(_ selection: Selection) {
    depth -= 1
    if depth > 0 { return }
    guard let group = open else { return }
    open = nil
    if !group.changes.isEmpty {
      group.selectionAfter = selection
      group.time = clock()
      push(group)
    }
  }

  public func record(_ change: Change, before: Selection, after: Selection, typing: Bool) {
    redoStack.removeAll()
    let now = clock()
    if let explicit = open {
      explicit.changes.append(change)
      explicit.selectionAfter = after
      explicit.time = now
      return
    }
    let kind = kindOf(change, typing: typing)
    if let last = undoStack.last, typing, last.typing, !selectionDirty, canMerge(last, change, kind, before, now) {
      merge(last, change, kind)
      last.selectionAfter = after
      last.time = now
      selectionDirty = false
      return
    }
    let group = Group(selectionBefore: before)
    group.changes.append(change)
    group.selectionAfter = after
    group.time = now
    group.kind = kind
    group.typing = typing
    push(group)
    selectionDirty = false
  }

  public func amendSelectionAfter(_ selection: Selection) {
    if let group = open ?? undoStack.last { group.selectionAfter = selection }
  }

  public func popUndo() -> Group? {
    guard let group = undoStack.popLast() else { return nil }
    redoStack.append(group)
    return group
  }

  public func popRedo() -> Group? {
    guard let group = redoStack.popLast() else { return nil }
    undoStack.append(group)
    return group
  }

  public func clear() {
    undoStack.removeAll()
    redoStack.removeAll()
    open = nil
    depth = 0
  }

  private func push(_ group: Group) {
    undoStack.append(group)
    if undoStack.count > maxGroups { undoStack.removeFirst(undoStack.count - maxGroups) }
  }

  private func kindOf(_ c: Change, typing: Bool) -> Kind {
    if !typing { return .other }
    if c.removed.isEmpty && c.inserted.utf16.count == 1 && c.inserted != "\n" { return .insert }
    if c.inserted.isEmpty && c.removed.utf16.count == 1 && c.removed != "\n" { return .backspace }
    return .other
  }

  private func canMerge(_ last: Group, _ c: Change, _ kind: Kind, _ before: Selection, _ now: Int64) -> Bool {
    if kind == .other || last.kind != kind { return false }
    if now - last.time >= 1000 { return false }
    if before != last.selectionAfter { return false }
    let prev = last.changes[last.changes.count - 1]
    return kind == .insert ? c.start == prev.newEnd : c.end == prev.start
  }

  private func merge(_ last: Group, _ c: Change, _ kind: Kind) {
    let prev = last.changes.removeLast()
    let merged =
      kind == .insert
      ? Change(start: prev.start, removed: prev.removed, inserted: prev.inserted + c.inserted, revision: c.revision)
      : Change(start: c.start, removed: c.removed + prev.removed, inserted: prev.inserted, revision: c.revision)
    last.changes.append(merged)
  }
}
