import Foundation

/// The editing state behind one editor: document, selection, history and settings. Only the main thread
/// mutates it; other threads read under `read`.
public final class EditorCore: @unchecked Sendable {
  public let document: Document
  public let lock = ReadWriteLock()
  public let history: UndoManager
  public var settings = EditorSettings()

  // Written on the main thread; the JS thread reads it under the lock.
  public private(set) var selection = Selection(anchor: 0, head: 0)

  public var onChange: ((Change, ChangeOrigin) -> Void)?
  public var onSelectionChange: ((Selection) -> Void)?

  public init(_ initialText: String = "", clock: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }) {
    document = Document(initialText)
    history = UndoManager(clock: clock)
  }

  public var canUndo: Bool { history.canUndo }
  public var canRedo: Bool { history.canRedo }

  /// Synchronous reads from the JS thread. Writers take the lock only inside Document.replace.
  public func read<T>(_ body: () throws -> T) rethrows -> T {
    try lock.read(body)
  }

  @discardableResult
  public func replace(_ start: Int, _ end: Int, _ text: String, origin: ChangeOrigin = .api) -> Change {
    applyChange(start, end, text, origin: origin, typing: false, caretAfter: false)
  }

  /// Every mutation goes through here. `typing` marks single key input that may coalesce in the history.
  /// `caretAfter` puts a collapsed caret after the inserted text instead of mapping the selection.
  @discardableResult
  func applyChange(_ start: Int, _ end: Int, _ text: String, origin: ChangeOrigin, typing: Bool, caretAfter: Bool) -> Change {
    let before = selection
    let change = lock.write { document.replace(start, end, text) }
    let after =
      caretAfter
      ? Selection.caret(change.newEnd)
      : Selection(anchor: EditorCore.mapOffset(before.anchor, change), head: EditorCore.mapOffset(before.head, change))
    moveSelection(after, fromEdit: true)
    if origin == .input || origin == .api { history.record(change, before: before, after: after, typing: typing) }
    onChange?(change, origin)
    return change
  }

  public func insertText(_ text: String, origin: ChangeOrigin = .api) {
    applyChange(selection.min, selection.max, text, origin: origin, typing: false, caretAfter: true)
  }

  /// A keyboard edit. The selection maps through the change like any edit; single unit deletes coalesce like typed backspaces.
  @discardableResult
  public func inputReplace(_ start: Int, _ end: Int, _ text: String, typing: Bool = false) -> Change {
    applyChange(start, end, text, origin: .input, typing: typing, caretAfter: false)
  }

  public func setText(_ text: String, keepHistory: Bool = false) {
    applyChange(0, document.length, text, origin: .api, typing: false, caretAfter: false)
    moveSelection(Selection(anchor: 0, head: 0), fromEdit: true)
    if !keepHistory { history.clear() }
  }

  public func typeText(_ text: String) {
    for scalar in text.unicodeScalars { typeUnit(String(scalar)) }
  }

  /// One unit of user input, a scalar or a keyboard commit.
  func typeUnit(_ s: String) {
    if s == "\n" {
      insertNewline()
      return
    }
    if s.utf16.count == 1, let typed = s.utf16.first {
      switch AutoCloser.actionFor(document, selection, typed: typed, settings) {
      case .skipCloser:
        moveSelection(Selection.caret(selection.head + 1))
        return
      case .insertPair(let pair):
        let start = selection.min
        applyChange(start, selection.max, pair, origin: .input, typing: false, caretAfter: false)
        moveSelection(Selection.caret(start + 1), fromEdit: true)
        history.amendSelectionAfter(selection)
        return
      case .wrap(let open, let close):
        let lo = selection.min
        let hi = selection.max
        history.beginGroup(selection)
        applyChange(hi, hi, String(decoding: [close], as: UTF16.self), origin: .input, typing: false, caretAfter: false)
        applyChange(lo, lo, String(decoding: [open], as: UTF16.self), origin: .input, typing: false, caretAfter: false)
        moveSelection(Selection(anchor: lo + 1, head: hi + 1), fromEdit: true)
        history.endGroup(selection)
        return
      case .none:
        break
      }
    }
    applyChange(selection.min, selection.max, s, origin: .input, typing: s.unicodeScalars.count == 1, caretAfter: true)
  }

  public func insertNewline() {
    let start = selection.min
    let nl = Indenter.newline(document, start, selection.max, settings)
    applyChange(start, selection.max, nl.text, origin: .input, typing: false, caretAfter: false)
    moveSelection(Selection.caret(start + nl.caretOffset), fromEdit: true)
    history.amendSelectionAfter(selection)
  }

  public func tab() {
    if document.lineAt(selection.min) != document.lineAt(selection.max) {
      indent()
    } else {
      applyChange(selection.min, selection.max, Indenter.unit(settings), origin: .input, typing: false, caretAfter: true)
    }
  }

  public func shiftTab() {
    outdent()
  }

  public func indent() {
    let unit = Indenter.unit(settings)
    history.beginGroup(selection)
    for line in Indenter.selectedLines(document, selection) {
      let start = document.lineStart(line)
      applyChange(start, start, unit, origin: .input, typing: false, caretAfter: false)
    }
    history.endGroup(selection)
  }

  public func outdent() {
    history.beginGroup(selection)
    for line in Indenter.selectedLines(document, selection) {
      let n = Indenter.outdentCount(document.line(line), settings)
      if n == 0 { continue }
      let start = document.lineStart(line)
      applyChange(start, start + n, "", origin: .input, typing: false, caretAfter: false)
    }
    history.endGroup(selection)
  }

  public func backspace() {
    if !selection.isEmpty {
      applyChange(selection.min, selection.max, "", origin: .input, typing: false, caretAfter: true)
      return
    }
    let caret = selection.head
    if caret == 0 { return }
    if settings.autoCloseBrackets && AutoCloser.deletesPair(document, caret: caret) {
      applyChange(caret - 1, caret + 1, "", origin: .input, typing: false, caretAfter: true)
      return
    }
    let from = TextMovement.prevGrapheme(document, caret)
    applyChange(from, caret, "", origin: .input, typing: caret - from == 1, caretAfter: true)
  }

  public func delete() {
    if !selection.isEmpty {
      applyChange(selection.min, selection.max, "", origin: .input, typing: false, caretAfter: true)
      return
    }
    let caret = selection.head
    if caret >= document.length { return }
    applyChange(caret, TextMovement.nextGrapheme(document, caret), "", origin: .input, typing: false, caretAfter: true)
  }

  @discardableResult
  public func undo() -> Bool {
    guard let group = history.popUndo() else { return false }
    for c in group.changes.reversed() {
      let change = lock.write { document.replace(c.start, c.newEnd, c.removed) }
      onChange?(change, .undo)
    }
    moveSelection(clamped(group.selectionBefore), fromEdit: true)
    return true
  }

  @discardableResult
  public func redo() -> Bool {
    guard let group = history.popRedo() else { return false }
    for c in group.changes {
      let change = lock.write { document.replace(c.start, c.end, c.inserted) }
      onChange?(change, .redo)
    }
    moveSelection(clamped(group.selectionAfter), fromEdit: true)
    return true
  }

  public func setSelection(anchor: Int, head: Int) {
    moveSelection(clamped(Selection(anchor: anchor, head: head)))
  }

  public func selectAll() {
    moveSelection(Selection(anchor: 0, head: document.length))
  }

  public func move(_ unit: TextMovement.Unit, forward: Bool, extend: Bool) {
    let doc = document
    let collapsing = !extend && !selection.isEmpty && unit == .char
    let from = collapsing ? (forward ? selection.max : selection.min) : selection.head
    let target: Int
    switch unit {
    case .char:
      target = collapsing ? from : (forward ? TextMovement.nextGrapheme(doc, from) : TextMovement.prevGrapheme(doc, from))
    case .word:
      target = forward ? TextMovement.nextWordEnd(doc, from) : TextMovement.prevWordStart(doc, from)
    case .lineStart:
      target = doc.lineStart(doc.lineAt(from))
    case .lineEnd:
      target = doc.lineEnd(doc.lineAt(from))
    case .docStart:
      target = 0
    case .docEnd:
      target = doc.length
    }
    moveSelection(extend ? Selection(anchor: selection.anchor, head: target) : Selection.caret(target))
  }

  public func selectWordAt(_ offset: Int) {
    let r = TextMovement.wordRangeAt(document, offset)
    moveSelection(Selection(anchor: r.start, head: r.end))
  }

  public func bracketMatch(skip: ((Int) -> Bool)?) -> (Int, Int)? {
    BracketMatcher.match(document, caret: selection.head, skip: skip)
  }

  private func clamped(_ s: Selection) -> Selection {
    let limit = document.length
    return Selection(anchor: max(0, min(s.anchor, limit)), head: max(0, min(s.head, limit)))
  }

  private func moveSelection(_ next: Selection, fromEdit: Bool = false) {
    if next == selection { return }
    if !fromEdit { history.selectionDirty = true }
    selection = next
    onSelectionChange?(next)
  }

  /// Maps an offset through a change. A caret sitting exactly at a pure insertion follows the insert.
  public static func mapOffset(_ offset: Int, _ c: Change) -> Int {
    if offset < c.start { return offset }
    if offset == c.start { return c.removed.isEmpty ? c.newEnd : offset }
    if offset >= c.end { return offset + c.delta }
    return c.newEnd
  }
}
