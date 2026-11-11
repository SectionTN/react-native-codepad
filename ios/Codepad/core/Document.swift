import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// The core's document: lines of UTF-16 units joined by `\n`, so every offset is the index JavaScript strings use.
/// Edits go through `EditorCore`.
final class Document {
  let handle: OpaquePointer
  // Whatever the host's callbacks reach through their context, kept alive as long as the core.
  private let context: AnyObject?

  init(_ initialText: String = "", host: cp_editor_host = cp_editor_host(), context: AnyObject? = nil) {
    var host = host
    let units = Array(initialText.utf16)
    handle = units.withUnsafeBufferPointer { cp_editor_new(&host, $0.baseAddress, UInt32($0.count)) }
    self.context = context
  }

  deinit {
    cp_editor_free(handle)
  }

  var length: Int { Int(cp_doc_length(handle)) }
  var revision: Int { Int(cp_doc_revision(handle)) }
  var lineCount: Int { Int(cp_doc_line_count(handle)) }

  func line(_ index: Int) -> [UInt16] {
    index >= 0 && index < lineCount ? units(lineStart(index), lineEnd(index)) : []
  }

  func lineString(_ index: Int) -> String {
    String(decoding: line(index), as: UTF16.self)
  }

  func lineLength(_ index: Int) -> Int {
    lineEnd(index) - lineStart(index)
  }

  /// Start offset of line `index`. `index == lineCount` yields `length + 1` so the prefix sums stay uniform.
  func lineStart(_ index: Int) -> Int {
    Int(cp_doc_line_start(handle, Int32(clamping: index)))
  }

  func lineEnd(_ index: Int) -> Int {
    Int(cp_doc_line_end(handle, Int32(clamping: index)))
  }

  func lineAt(_ offset: Int) -> Int {
    Int(cp_doc_line_at(handle, Document.unsigned(offset)))
  }

  func offsetToPosition(_ offset: Int) -> Position {
    let p = cp_doc_position(handle, Document.unsigned(offset))
    return Position(line: Int(p.line), column: Int(p.column))
  }

  func positionToOffset(line: Int, column: Int) -> Int {
    Int(cp_doc_offset(handle, Int32(clamping: line), Int32(clamping: column)))
  }

  /// The unit at `offset`, clamped into the document. A line end reads as the newline unit.
  func unit(at offset: Int) -> UInt16 {
    cp_doc_unit_at(handle, Document.unsigned(offset))
  }

  func text() -> String {
    text(0, length)
  }

  func text(_ start: Int, _ end: Int) -> String {
    String(decoding: units(start, end), as: UTF16.self)
  }

  private func units(_ start: Int, _ end: Int) -> [UInt16] {
    let s = Document.unsigned(start)
    let e = Document.unsigned(end)
    let count = Int(cp_doc_copy(handle, s, e, nil, 0))
    // An empty array initialized in place writes its count into the shared empty storage, a race between readers.
    if count == 0 { return [] }
    return [UInt16](unsafeUninitializedCapacity: count) { buffer, initialized in
      cp_doc_copy(handle, s, e, buffer.baseAddress, UInt32(count))
      initialized = count
    }
  }

  static func unsigned(_ offset: Int) -> UInt32 {
    UInt32(clamping: max(0, offset))
  }
}
