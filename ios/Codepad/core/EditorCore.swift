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

  var searchActive: Bool { cp_editor_search_active(document.handle) != 0 }

  /// The matches as start and end pairs, computed on the calling thread when stale.
  var matches: [Int] {
    let count = Int(cp_editor_matches(document.handle, nil, 0))
    if count == 0 { return [] }
    var out = [Int32](repeating: 0, count: count)
    cp_editor_matches(document.handle, &out, UInt32(count))
    return out.map(Int.init)
  }

  var matchCount: Int { Int(cp_editor_match_count(document.handle)) }

  /// True while a query is active and its matches belong to an older revision.
  var searchStale: Bool { cp_editor_search_stale(document.handle) != 0 }

  /// An invalid regex throws before any state changes, except that it clears the search. The matches stay stale
  /// until something asks for them or acceptMatches lands.
  func setSearch(_ query: SearchQuery) throws {
    var flags: Int32 = 0
    if query.regex { flags |= Int32(CP_SEARCH_REGEX) }
    if query.caseSensitive { flags |= Int32(CP_SEARCH_CASE) }
    if query.wholeWord { flags |= Int32(CP_SEARCH_WORD) }
    var error = [CChar](repeating: 0, count: 512)
    let units = Array(query.text.utf16)
    let ok = units.withUnsafeBufferPointer {
      cp_editor_set_search(document.handle, $0.baseAddress, UInt32($0.count), flags, &error, UInt32(error.count))
    }
    if ok == 0 {
      let bytes = error.prefix { $0 != 0 }.map { UInt8(bitPattern: $0) }
      throw SearchError(message: String(decoding: bytes, as: UTF8.self))
    }
  }

  func clearSearch() {
    cp_editor_clear_search(document.handle)
  }

  /// Computes the matches on the calling thread when they are stale.
  func ensureMatches() {
    cp_editor_matches(document.handle, nil, 0)
  }

  /// The compiled query for a search worker, or nil without a search.
  func compiledSearch() -> CompiledSearch? {
    cp_editor_search_query(document.handle).map(CompiledSearch.init)
  }

  /// The current text for a worker, unchanged by later edits.
  func textSnapshot() -> TextSnapshot {
    TextSnapshot(cp_editor_text(document.handle)!)
  }

  /// Stores matches computed elsewhere. False when the document moved on since `revision`.
  func acceptMatches(revision: Int, matches: [Int]) -> Bool {
    let pairs = matches.map { Int32(clamping: $0) }
    return pairs.withUnsafeBufferPointer {
      cp_editor_accept_matches(document.handle, Int32(clamping: revision), $0.baseAddress, UInt32($0.count))
    } != 0
  }

  func findNext() -> SearchHit? { find(forward: true) }

  func findPrevious() -> SearchHit? { find(forward: false) }

  func replaceCurrent(_ text: String) -> Bool {
    let units = Array(text.utf16)
    return units.withUnsafeBufferPointer { cp_editor_replace_current(document.handle, $0.baseAddress, UInt32($0.count)) } != 0
  }

  func replaceAll(_ text: String) -> Int {
    let units = Array(text.utf16)
    return Int(units.withUnsafeBufferPointer { cp_editor_replace_all(document.handle, $0.baseAddress, UInt32($0.count)) })
  }

  private func find(forward: Bool) -> SearchHit? {
    var index: Int32 = 0
    var total: Int32 = 0
    if cp_editor_find(document.handle, forward ? 1 : 0, &index, &total) == 0 { return nil }
    return SearchHit(index: Int(index), total: Int(total))
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
