import Foundation

/// The editing state behind one editor: document, selection, history and settings. Only the main thread
/// mutates it; other threads read under `read`.
final class EditorCore: @unchecked Sendable {
  let document: Document
  let lock = ReadWriteLock()
  let history: UndoManager
  var settings = EditorSettings()

  // Written on the main thread; the JS thread reads it under the lock.
  private(set) var selection = Selection(anchor: 0, head: 0)

  var onChange: ((Change, ChangeOrigin) -> Void)?
  var onSelectionChange: ((Selection) -> Void)?

  static let decorationEditLog = 256
  let decorations = DecorationSet()
  private var edits: [EditSpan] = []

  // A decoration set computed before this revision belongs to text setText replaced.
  private var decorationsFloor = 0

  init(_ initialText: String = "", clock: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }) {
    document = Document(initialText)
    history = UndoManager(clock: clock)
  }

  var canUndo: Bool { history.canUndo }
  var canRedo: Bool { history.canRedo }

  /// Synchronous reads from the JS thread. Writers take the lock only inside Document.replace.
  func read<T>(_ body: () throws -> T) rethrows -> T {
    try lock.read(body)
  }

  @discardableResult
  func replace(_ start: Int, _ end: Int, _ text: String, origin: ChangeOrigin = .api) -> Change {
    applyChange(start, end, text, origin: origin, typing: false, caretAfter: false)
  }

  /// Every mutation goes through here. `typing` marks single key input that may coalesce in the history.
  /// `caretAfter` puts a collapsed caret after the inserted text instead of mapping the selection.
  @discardableResult
  func applyChange(_ start: Int, _ end: Int, _ text: String, origin: ChangeOrigin, typing: Bool, caretAfter: Bool) -> Change {
    let before = selection
    let change = lock.write { document.replace(start, end, text) }
    let span = EditSpan.of(change, document)
    if edits.count == EditorCore.decorationEditLog { edits.removeFirst() }
    edits.append(span)
    decorations.map(span)
    let after =
      caretAfter
      ? Selection.caret(change.newEnd)
      : Selection(anchor: EditorCore.mapOffset(before.anchor, change), head: EditorCore.mapOffset(before.head, change))
    moveSelection(after, fromEdit: true)
    if origin == .input || origin == .api { history.record(change, before: before, after: after, typing: typing) }
    onChange?(change, origin)
    return change
  }

  func insertText(_ text: String, origin: ChangeOrigin = .api) {
    applyChange(selection.min, selection.max, text, origin: origin, typing: false, caretAfter: true)
  }

  /// A keyboard edit. The selection maps through the change like any edit; single unit deletes coalesce like typed backspaces.
  @discardableResult
  func inputReplace(_ start: Int, _ end: Int, _ text: String, typing: Bool = false) -> Change {
    applyChange(start, end, text, origin: .input, typing: typing, caretAfter: false)
  }

  func setText(_ text: String, keepHistory: Bool = false) {
    applyChange(0, document.length, text, origin: .api, typing: false, caretAfter: false)
    moveSelection(Selection(anchor: 0, head: 0), fromEdit: true)
    if !keepHistory { history.clear() }
    decorations.clear()
    edits.removeAll()
    decorationsFloor = document.revision
  }

  /// Replaces the decorations. `revision` is the document revision they were computed for, below zero for the
  /// current one. False when the edits since then are no longer known, which keeps the current set.
  @discardableResult
  func setDecorations(_ items: [Decoration], revision: Int) -> Bool {
    var list = items
    if revision >= 0 && revision < document.revision {
      if revision < decorationsFloor { return false }
      if (edits.first?.revision ?? Int.max) > revision + 1 { return false }
      list = []
      for item in items {
        var d: Decoration? = item
        for span in edits where span.revision > revision {
          if let current = d { d = DecorationSet.mapOne(current, span) }
        }
        if let d { list.append(d) }
      }
    }
    decorations.replace(list.compactMap(fitted))
    return true
  }

  /// Clamps an underline to the document. Nil for an empty range, a line outside it or a gap without rows.
  private func fitted(_ d: Decoration) -> Decoration? {
    switch d {
    case .underline(var u):
      u.start = min(max(u.start, 0), document.length)
      u.end = min(max(u.end, 0), document.length)
      return u.start < u.end ? .underline(u) : nil
    case .gap(let line, let rows):
      return line >= 0 && line < document.lineCount && rows >= 1 ? d : nil
    case .lineBackground(let line, _):
      return line >= 0 && line < document.lineCount ? d : nil
    }
  }

  func typeText(_ text: String) {
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

  func insertNewline() {
    let start = selection.min
    let nl = Indenter.newline(document, start, selection.max, settings)
    applyChange(start, selection.max, nl.text, origin: .input, typing: false, caretAfter: false)
    moveSelection(Selection.caret(start + nl.caretOffset), fromEdit: true)
    history.amendSelectionAfter(selection)
  }

  func tab() {
    if document.lineAt(selection.min) != document.lineAt(selection.max) {
      indent()
    } else {
      applyChange(selection.min, selection.max, Indenter.unit(settings), origin: .input, typing: false, caretAfter: true)
    }
  }

  func shiftTab() {
    outdent()
  }

  func indent() {
    let unit = Indenter.unit(settings)
    history.beginGroup(selection)
    for line in Indenter.selectedLines(document, selection) {
      let start = document.lineStart(line)
      applyChange(start, start, unit, origin: .input, typing: false, caretAfter: false)
    }
    history.endGroup(selection)
  }

  func outdent() {
    history.beginGroup(selection)
    for line in Indenter.selectedLines(document, selection) {
      let n = Indenter.outdentCount(document.line(line), settings)
      if n == 0 { continue }
      let start = document.lineStart(line)
      applyChange(start, start + n, "", origin: .input, typing: false, caretAfter: false)
    }
    history.endGroup(selection)
  }

  func backspace() {
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

  func delete() {
    if !selection.isEmpty {
      applyChange(selection.min, selection.max, "", origin: .input, typing: false, caretAfter: true)
      return
    }
    let caret = selection.head
    if caret >= document.length { return }
    applyChange(caret, TextMovement.nextGrapheme(document, caret), "", origin: .input, typing: false, caretAfter: true)
  }

  @discardableResult
  func undo() -> Bool {
    guard let group = history.popUndo() else { return false }
    for c in group.changes.reversed() {
      let change = lock.write { document.replace(c.start, c.newEnd, c.removed) }
      onChange?(change, .undo)
    }
    moveSelection(clamped(group.selectionBefore), fromEdit: true)
    return true
  }

  @discardableResult
  func redo() -> Bool {
    guard let group = history.popRedo() else { return false }
    for c in group.changes {
      let change = lock.write { document.replace(c.start, c.end, c.inserted) }
      onChange?(change, .redo)
    }
    moveSelection(clamped(group.selectionAfter), fromEdit: true)
    return true
  }

  func setSelection(anchor: Int, head: Int) {
    moveSelection(clamped(Selection(anchor: anchor, head: head)))
  }

  func selectAll() {
    moveSelection(Selection(anchor: 0, head: document.length))
  }

  func move(_ unit: TextMovement.Unit, forward: Bool, extend: Bool) {
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

  func selectWordAt(_ offset: Int) {
    let r = TextMovement.wordRangeAt(document, offset)
    moveSelection(Selection(anchor: r.start, head: r.end))
  }

  func bracketMatch(skip: ((Int) -> Bool)?) -> (Int, Int)? {
    BracketMatcher.match(document, caret: selection.head, skip: skip)
  }

  struct SearchHit: Equatable, Sendable {
    let index: Int
    let total: Int

    init(index: Int, total: Int) {
      self.index = index
      self.total = total
    }
  }

  private(set) var search: SearchSession?

  var matches: [Int] { search?.matches ?? [] }
  var matchCount: Int { search?.count ?? 0 }

  /// True while a query is active and its matches belong to an older revision.
  var searchStale: Bool {
    guard let s = search else { return false }
    return s.revision != document.revision
  }

  /// Compiles first so an invalid regex throws before any state changes. The matches stay stale until ensureMatches or acceptMatches.
  func setSearch(_ query: SearchQuery) throws {
    let pattern: NSRegularExpression
    do {
      pattern = try Searcher.compile(query)
    } catch {
      clearSearch()
      throw error
    }
    search = SearchSession(query: query, pattern: pattern)
  }

  func clearSearch() {
    search = nil
  }

  /// Computes the matches on the calling thread when they are stale.
  func ensureMatches() {
    guard let s = search, s.revision != document.revision else { return }
    // The query compiled in setSearch and nothing cancels here, so find cannot throw.
    s.matches = (try? Searcher.find(document.text(), s.query)) ?? []
    s.revision = document.revision
  }

  /// Stores matches computed elsewhere; false when the document moved on since `revision`.
  func acceptMatches(revision: Int, matches: [Int]) -> Bool {
    guard let s = search, revision == document.revision else { return false }
    s.matches = matches
    s.revision = revision
    return true
  }

  func findNext() -> SearchHit? {
    ensureMatches()
    guard let s = search else { return nil }
    let index = s.nextIndex(selection)
    return index < 0 ? nil : selectMatch(s, index)
  }

  func findPrevious() -> SearchHit? {
    ensureMatches()
    guard let s = search else { return nil }
    let index = s.previousIndex(selection)
    return index < 0 ? nil : selectMatch(s, index)
  }

  func replaceCurrent(_ text: String) -> Bool {
    ensureMatches()
    guard let s = search else { return false }
    let current = s.indexOf(selection.range)
    if current < 0 { return false }
    applyChange(s.matches[current * 2], s.matches[current * 2 + 1], text, origin: .api, typing: false, caretAfter: true)
    ensureMatches()
    if s.count > 0 {
      var index = s.indexAtOrAfter(selection.min)
      if index >= s.count { index = 0 }
      selectMatch(s, index)
    }
    return true
  }

  func replaceAll(_ text: String) -> Int {
    ensureMatches()
    guard let s = search else { return 0 }
    let targets = s.matches
    if targets.isEmpty { return 0 }
    history.beginGroup(selection)
    var i = targets.count - 2
    while i >= 0 {
      applyChange(targets[i], targets[i + 1], text, origin: .api, typing: false, caretAfter: false)
      i -= 2
    }
    history.endGroup(selection)
    ensureMatches()
    return targets.count / 2
  }

  @discardableResult
  private func selectMatch(_ s: SearchSession, _ index: Int) -> SearchHit {
    moveSelection(Selection(anchor: s.matches[index * 2], head: s.matches[index * 2 + 1]))
    return SearchHit(index: index, total: s.count)
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
  static func mapOffset(_ offset: Int, _ c: Change) -> Int {
    if offset < c.start { return offset }
    if offset == c.start { return c.removed.isEmpty ? c.newEnd : offset }
    if offset >= c.end { return offset + c.delta }
    return c.newEnd
  }
}
