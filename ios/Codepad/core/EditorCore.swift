import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// The editing state behind one editor, kept in the core: document, selection, history and settings. Only the main
/// thread mutates it. Other threads read under `read`.
final class EditorCore: @unchecked Sendable {
  /// What the core's callbacks reach through their context. The document keeps it alive as long as the core.
  private final class Host {
    let clock: () -> Int64
    weak var core: EditorCore?

    init(clock: @escaping () -> Int64) {
      self.clock = clock
    }
  }

  let document: Document
  let history: UndoManager
  let decorations: DecorationSet

  var settings = EditorSettings() {
    didSet { pushSettings() }
  }

  var onChange: ((Change, ChangeOrigin) -> Void)?
  var onSelectionChange: ((Selection) -> Void)?

  // The change the last edit reported, so the edit methods can return it.
  private var lastChange: Change?

  init(_ initialText: String = "", clock: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }) {
    let host = Host(clock: clock)
    var callbacks = cp_editor_host()
    callbacks.ctx = Unmanaged.passUnretained(host).toOpaque()
    callbacks.now_millis = { ctx in
      Unmanaged<Host>.fromOpaque(ctx!).takeUnretainedValue().clock()
    }
    callbacks.on_change = { ctx, change, removed, inserted, origin in
      Unmanaged<Host>.fromOpaque(ctx!).takeUnretainedValue().core?.changed(change!.pointee, removed, inserted, origin)
    }
    callbacks.on_selection = { ctx, anchor, head in
      let core = Unmanaged<Host>.fromOpaque(ctx!).takeUnretainedValue().core
      core?.onSelectionChange?(Selection(anchor: Int(anchor), head: Int(head)))
    }
    document = Document(initialText, host: callbacks, context: host)
    history = UndoManager(document)
    decorations = DecorationSet(document)
    host.core = self
    pushSettings()
  }

  var selection: Selection {
    let packed = cp_editor_selection(document.handle)
    return Selection(anchor: Int(Int32(truncatingIfNeeded: packed >> 32)), head: Int(Int32(truncatingIfNeeded: packed)))
  }

  var canUndo: Bool { history.canUndo }
  var canRedo: Bool { history.canRedo }

  /// Synchronous reads from the JS thread. Writers hold the lock only while the core swaps the text.
  func read<T>(_ body: () throws -> T) rethrows -> T {
    cp_editor_lock_shared(document.handle)
    defer { cp_editor_unlock_shared(document.handle) }
    return try body()
  }

  @discardableResult
  func replace(_ start: Int, _ end: Int, _ text: String, origin: ChangeOrigin = .api) -> Change {
    applyChange(start, end, text, origin: origin, typing: false, caretAfter: false)
  }

  /// Every mutation goes through here. `typing` marks single key input that may coalesce in the history.
  /// `caretAfter` puts a collapsed caret after the inserted text instead of mapping the selection.
  @discardableResult
  func applyChange(_ start: Int, _ end: Int, _ text: String, origin: ChangeOrigin, typing: Bool, caretAfter: Bool) -> Change {
    lastChange = nil
    let units = Array(text.utf16)
    units.withUnsafeBufferPointer {
      cp_editor_replace(
        document.handle, Document.unsigned(start), Document.unsigned(end), $0.baseAddress, UInt32($0.count),
        EditorCore.code(origin), typing ? 1 : 0, caretAfter ? 1 : 0)
    }
    return lastChange!
  }

  func insertText(_ text: String, origin: ChangeOrigin = .api) {
    let units = Array(text.utf16)
    units.withUnsafeBufferPointer { cp_editor_insert(document.handle, $0.baseAddress, UInt32($0.count), EditorCore.code(origin)) }
  }

  /// A keyboard edit. The selection maps through the change like any edit. Single unit deletes coalesce like typed backspaces.
  @discardableResult
  func inputReplace(_ start: Int, _ end: Int, _ text: String, typing: Bool = false) -> Change {
    applyChange(start, end, text, origin: .input, typing: typing, caretAfter: false)
  }

  func setText(_ text: String, keepHistory: Bool = false) {
    let units = Array(text.utf16)
    units.withUnsafeBufferPointer { cp_editor_set_text(document.handle, $0.baseAddress, UInt32($0.count), keepHistory ? 1 : 0) }
  }

  /// Replaces the decorations. `revision` is the document revision they were computed for, below zero for the
  /// current one. False when the edits since then are no longer known, which keeps the current set.
  @discardableResult
  func setDecorations(_ items: [Decoration], revision: Int) -> Bool {
    decorations.replace(items, revision: revision)
  }

  func typeText(_ text: String) {
    let units = Array(text.utf16)
    units.withUnsafeBufferPointer { cp_editor_type(document.handle, $0.baseAddress, UInt32($0.count)) }
  }

  func insertNewline() { command(CP_CMD_NEWLINE) }
  func tab() { command(CP_CMD_TAB) }
  func shiftTab() { command(CP_CMD_SHIFT_TAB) }
  func indent() { command(CP_CMD_INDENT) }
  func outdent() { command(CP_CMD_OUTDENT) }
  func backspace() { command(CP_CMD_BACKSPACE) }
  func delete() { command(CP_CMD_DELETE) }
  func selectAll() { command(CP_CMD_SELECT_ALL) }

  @discardableResult
  func undo() -> Bool { command(CP_CMD_UNDO) }

  @discardableResult
  func redo() -> Bool { command(CP_CMD_REDO) }

  func setSelection(anchor: Int, head: Int) {
    cp_editor_set_selection(document.handle, Int32(clamping: anchor), Int32(clamping: head))
  }

  func move(_ unit: TextMovement.Unit, forward: Bool, extend: Bool) {
    cp_editor_move(document.handle, unit.rawValue, forward ? 1 : 0, extend ? 1 : 0)
  }

  func selectWordAt(_ offset: Int) {
    cp_editor_select_word_at(document.handle, Document.unsigned(offset))
  }

  func bracketMatch(snapshot: Snapshot?) -> (Int, Int)? {
    BracketMatcher.match(document, caret: selection.head, snapshot: snapshot)
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

  /// Stores matches computed elsewhere. False when the document moved on since `revision`.
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
    history.beginGroup()
    var i = targets.count - 2
    while i >= 0 {
      applyChange(targets[i], targets[i + 1], text, origin: .api, typing: false, caretAfter: false)
      i -= 2
    }
    history.endGroup()
    ensureMatches()
    return targets.count / 2
  }

  @discardableResult
  private func selectMatch(_ s: SearchSession, _ index: Int) -> SearchHit {
    setSelection(anchor: s.matches[index * 2], head: s.matches[index * 2 + 1])
    return SearchHit(index: index, total: s.count)
  }

  @discardableResult
  private func command(_ command: Int) -> Bool {
    cp_editor_command(document.handle, Int32(command)) != 0
  }

  private func pushSettings() {
    var s = cp_settings()
    s.tab_size = Int32(clamping: settings.tabSize)
    s.insert_spaces = settings.insertSpaces ? 1 : 0
    s.auto_indent = settings.autoIndent ? 1 : 0
    s.auto_close = settings.autoCloseBrackets ? 1 : 0
    cp_editor_set_settings(document.handle, &s)
  }

  private func changed(
    _ c: cp_change, _ removed: UnsafePointer<UInt16>?, _ inserted: UnsafePointer<UInt16>?, _ origin: Int32
  ) {
    let change = Change(
      start: Int(c.start),
      removed: EditorCore.string(removed, Int(c.removed_len)),
      inserted: EditorCore.string(inserted, Int(c.inserted_len)),
      revision: Int(c.revision))
    lastChange = change
    onChange?(change, EditorCore.origin(origin))
  }

  private static func string(_ units: UnsafePointer<UInt16>?, _ count: Int) -> String {
    guard let units, count > 0 else { return "" }
    return String(decoding: UnsafeBufferPointer(start: units, count: count), as: UTF16.self)
  }

  private static func code(_ origin: ChangeOrigin) -> Int32 {
    switch origin {
    case .input: return Int32(CP_ORIGIN_INPUT)
    case .api: return Int32(CP_ORIGIN_API)
    case .undo: return Int32(CP_ORIGIN_UNDO)
    case .redo: return Int32(CP_ORIGIN_REDO)
    }
  }

  private static func origin(_ code: Int32) -> ChangeOrigin {
    switch Int(code) {
    case Int(CP_ORIGIN_INPUT): return .input
    case Int(CP_ORIGIN_UNDO): return .undo
    case Int(CP_ORIGIN_REDO): return .redo
    default: return .api
    }
  }
}
