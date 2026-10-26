#if canImport(CTreeSitter)
  import CTreeSitter
#endif
import Foundation
import os

/// A row and a column in UTF-16 units. tree-sitter reports bytes; the wrapper halves them at the boundary.
struct Point: Hashable, Sendable {
  let row: Int
  let column: Int

  init(row: Int, column: Int) {
    self.row = row
    self.column = column
  }

  init(_ p: TSPoint) {
    row = Int(p.row)
    column = Int(p.column) / 2
  }

  var ts: TSPoint { TSPoint(row: UInt32(row), column: UInt32(column * 2)) }
}

struct InputEdit: Hashable, Sendable {
  let start: Int
  let oldEnd: Int
  let newEnd: Int
  let startPoint: Point
  let oldEndPoint: Point
  let newEndPoint: Point

  init(start: Int, oldEnd: Int, newEnd: Int, startPoint: Point, oldEndPoint: Point, newEndPoint: Point) {
    self.start = start
    self.oldEnd = oldEnd
    self.newEnd = newEnd
    self.startPoint = startPoint
    self.oldEndPoint = oldEndPoint
    self.newEndPoint = newEndPoint
  }
}

/// A TSNode over its tree. Valid while the tree is alive.
struct Node {
  let raw: TSNode

  var isNull: Bool { ts_node_is_null(raw) }
  var startUnit: Int { Int(ts_node_start_byte(raw)) / 2 }
  var endUnit: Int { Int(ts_node_end_byte(raw)) / 2 }
  var startPoint: Point { Point(ts_node_start_point(raw)) }
  var endPoint: Point { Point(ts_node_end_point(raw)) }
  var type: String { isNull ? "" : String(cString: ts_node_type(raw)) }
  var parent: Node { Node(raw: ts_node_parent(raw)) }
  var childCount: Int { Int(ts_node_child_count(raw)) }

  func child(_ index: Int) -> Node {
    Node(raw: ts_node_child(raw, UInt32(index)))
  }

  func descendant(forUnits start: Int, _ end: Int) -> Node {
    Node(raw: ts_node_descendant_for_byte_range(raw, UInt32(start * 2), UInt32(end * 2)))
  }
}

/// The UTF-16 copy of the document the parser reads, edited in step with it on the syntax queue.
final class Mirror {
  private(set) var units: [UInt16] = []

  init() {}

  var length: Int { units.count }

  func replace(_ start: Int, _ end: Int, _ text: String) {
    let (s, e) = clamp(start, end)
    units.replaceSubrange(s..<e, with: text.utf16)
  }

  func setText(_ text: String) {
    units = Array(text.utf16)
  }

  /// Shares the buffer until either side is edited.
  func copy() -> Mirror {
    let m = Mirror()
    m.units = units
    return m
  }

  func text(_ start: Int, _ end: Int) -> String {
    let (s, e) = clamp(start, end)
    return String(decoding: units[s..<e], as: UTF16.self)
  }

  private func clamp(_ start: Int, _ end: Int) -> (Int, Int) {
    let s = max(0, min(start, units.count))
    let e = max(0, min(end, units.count))
    return s <= e ? (s, e) : (e, s)
  }
}

/// Set from the main thread, read by the parser's progress callback on the syntax queue.
final class CancelFlag: @unchecked Sendable {
  private let state = OSAllocatedUnfairLock(initialState: false)

  init() {}

  var isSet: Bool { state.withLock { $0 } }

  func set(_ value: Bool) {
    state.withLock { $0 = value }
  }
}

/// What the C callbacks read during one parse call: the mirror's buffer, the flag and the deadline.
private final class ParseContext {
  var base: UnsafePointer<UInt16>?
  var count = 0
  var flag: CancelFlag?
  var deadline: UInt64 = 0
}

private let readMirror:
  @convention(c) (UnsafeMutableRawPointer?, UInt32, TSPoint, UnsafeMutablePointer<UInt32>?) -> UnsafePointer<CChar>? = {
    payload, byteIndex, _, bytesRead in
    guard let payload else {
      bytesRead?.pointee = 0
      return nil
    }
    let ctx = Unmanaged<ParseContext>.fromOpaque(payload).takeUnretainedValue()
    let unit = Int(byteIndex) / 2
    guard let base = ctx.base, unit < ctx.count else {
      bytesRead?.pointee = 0
      return nil
    }
    bytesRead?.pointee = UInt32((ctx.count - unit) * 2)
    return UnsafeRawPointer(base + unit).assumingMemoryBound(to: CChar.self)
  }

private let parseProgress: @convention(c) (UnsafeMutablePointer<TSParseState>?) -> Bool = { state in
  guard let payload = state?.pointee.payload else { return false }
  let ctx = Unmanaged<ParseContext>.fromOpaque(payload).takeUnretainedValue()
  if let flag = ctx.flag, flag.isSet { return true }
  return ctx.deadline > 0 && DispatchTime.now().uptimeNanoseconds >= ctx.deadline
}

/// A tree-sitter tree. Read-only once parsed except for `edit`, which only the engine's own tree receives on its queue.
final class Tree: @unchecked Sendable {
  let raw: OpaquePointer

  init(_ raw: OpaquePointer) {
    self.raw = raw
  }

  deinit {
    ts_tree_delete(raw)
  }

  func copy() -> Tree {
    Tree(ts_tree_copy(raw))
  }

  var rootNode: Node { Node(raw: ts_tree_root_node(raw)) }

  func edit(_ e: InputEdit) {
    var edit = TSInputEdit(
      start_byte: UInt32(e.start * 2), old_end_byte: UInt32(e.oldEnd * 2), new_end_byte: UInt32(e.newEnd * 2),
      start_point: e.startPoint.ts, old_end_point: e.oldEndPoint.ts, new_end_point: e.newEndPoint.ts)
    ts_tree_edit(raw, &edit)
  }

  /// Six ints per range like Parser.setIncludedRanges; edits shift them along with the nodes.
  func includedRanges() -> [Int] {
    var count: UInt32 = 0
    guard let ranges = ts_tree_included_ranges(raw, &count) else { return [] }
    defer { free(ranges) }
    return TreeSitterRuntime.flatten(ranges, Int(count))
  }

  /// Unit pairs whose syntax differs from `old`, the edited tree this one was parsed against.
  func changedRanges(since old: Tree) -> [Int] {
    var count: UInt32 = 0
    guard let ranges = ts_tree_get_changed_ranges(old.raw, raw, &count) else { return [] }
    defer { free(ranges) }
    var out: [Int] = []
    out.reserveCapacity(Int(count) * 2)
    for i in 0..<Int(count) {
      let r = ranges[i]
      out.append(Int(r.start_byte) / 2)
      out.append(Int(r.end_byte) / 2)
    }
    return out
  }
}

final class Parser {
  let raw: OpaquePointer

  init() {
    raw = ts_parser_new()
  }

  deinit {
    ts_parser_delete(raw)
  }

  @discardableResult
  func setLanguage(_ language: OpaquePointer) -> Bool {
    ts_parser_set_language(raw, language)
  }

  func reset() {
    ts_parser_reset(raw)
  }

  /// Six ints per range (start, end, startRow, startColumn, endRow, endColumn) in units.
  @discardableResult
  func setIncludedRanges(_ ranges: [Int]) -> Bool {
    let converted = TreeSitterRuntime.ranges(from: ranges)
    return converted.withUnsafeBufferPointer { ts_parser_set_included_ranges(raw, $0.baseAddress, UInt32($0.count)) }
  }

  /// Nil means the flag or the budget cancelled the parse. Parse again to resume, or reset first.
  func parse(_ old: Tree?, _ mirror: Mirror, _ cancel: CancelFlag?, budgetMicros: Int64) -> Tree? {
    let ctx = ParseContext()
    ctx.flag = cancel
    ctx.deadline = budgetMicros > 0 ? DispatchTime.now().uptimeNanoseconds + UInt64(budgetMicros) * 1000 : 0
    let payload = Unmanaged.passUnretained(ctx).toOpaque()
    let result = mirror.units.withUnsafeBufferPointer { buffer -> OpaquePointer? in
      ctx.base = buffer.baseAddress
      ctx.count = buffer.count
      let input = TSInput(payload: payload, read: readMirror, encoding: TSInputEncodingUTF16LE, decode: nil)
      let options = TSParseOptions(payload: payload, progress_callback: parseProgress)
      return ts_parser_parse_with_options(raw, old?.raw, input, options)
    }
    return result.map { Tree($0) }
  }
}

struct QueryError: Error, Equatable, Sendable {
  let offset: Int
  let type: Int
}

/// A compiled query. Read-only after compile apart from disablePattern, so cursors on any thread may run it.
final class Query: @unchecked Sendable {
  let raw: OpaquePointer
  let patternCount: Int
  let captureNames: [String]
  let stringValues: [String]

  private init(_ raw: OpaquePointer) {
    self.raw = raw
    patternCount = Int(ts_query_pattern_count(raw))
    captureNames = (0..<ts_query_capture_count(raw)).map { index in
      var length: UInt32 = 0
      return TreeSitterRuntime.string(ts_query_capture_name_for_id(raw, index, &length), length)
    }
    stringValues = (0..<ts_query_string_count(raw)).map { index in
      var length: UInt32 = 0
      return TreeSitterRuntime.string(ts_query_string_value_for_id(raw, index, &length), length)
    }
  }

  deinit {
    ts_query_delete(raw)
  }

  static func compile(_ language: OpaquePointer, _ source: String) throws -> Query {
    var errorOffset: UInt32 = 0
    var errorType = TSQueryErrorNone
    let raw = source.withCString { cString in
      ts_query_new(language, cString, UInt32(strlen(cString)), &errorOffset, &errorType)
    }
    guard let raw else { throw QueryError(offset: Int(errorOffset), type: Int(errorType.rawValue)) }
    return Query(raw)
  }

  /// Flat (type, value id) pairs of the pattern's predicate steps: 0 done, 1 capture, 2 string.
  func predicates(_ pattern: Int) -> [Int] {
    var count: UInt32 = 0
    guard let steps = ts_query_predicates_for_pattern(raw, UInt32(pattern), &count) else { return [] }
    var out: [Int] = []
    out.reserveCapacity(Int(count) * 2)
    for i in 0..<Int(count) {
      out.append(Int(steps[i].type.rawValue))
      out.append(Int(steps[i].value_id))
    }
    return out
  }

  func disablePattern(_ pattern: Int) {
    ts_query_disable_pattern(raw, UInt32(pattern))
  }
}

struct Capture {
  let node: Node
  let captureIndex: Int
  let patternIndex: Int
  let matchId: Int
}

final class QueryCursor {
  let raw: OpaquePointer
  private var match = TSQueryMatch()

  init() {
    raw = ts_query_cursor_new()
  }

  deinit {
    ts_query_cursor_delete(raw)
  }

  func exec(_ query: Query, _ node: Node) {
    ts_query_cursor_exec(raw, query.raw, node.raw)
  }

  func setUnitRange(_ start: Int, _ end: Int) {
    _ = ts_query_cursor_set_byte_range(raw, UInt32(start * 2), UInt32(end * 2))
  }

  func nextCapture() -> Capture? {
    var index: UInt32 = 0
    guard ts_query_cursor_next_capture(raw, &match, &index) else { return nil }
    return capture(at: Int(index))
  }

  /// Advances to the next finished match, every capture included whether or not it lies inside the unit range.
  func nextMatch() -> Bool {
    ts_query_cursor_next_match(raw, &match)
  }

  var matchCaptureCount: Int { Int(match.capture_count) }

  /// The i-th capture of the match returned by the last nextCapture or nextMatch call.
  func matchCapture(_ index: Int) -> Capture {
    capture(at: index)
  }

  func removeMatch(_ matchId: Int) {
    ts_query_cursor_remove_match(raw, UInt32(matchId))
  }

  private func capture(at index: Int) -> Capture {
    let c = match.captures[index]
    return Capture(node: Node(raw: c.node), captureIndex: Int(c.index), patternIndex: Int(match.pattern_index), matchId: Int(match.id))
  }
}

enum TreeSitterRuntime {
  /// The language ABI versions this runtime loads.
  static let abiRange = Int(TREE_SITTER_MIN_COMPATIBLE_LANGUAGE_VERSION)...Int(TREE_SITTER_LANGUAGE_VERSION)

  static func abiVersion(of language: OpaquePointer) -> Int {
    Int(ts_language_abi_version(language))
  }

  static func ranges(from flat: [Int]) -> [TSRange] {
    var out: [TSRange] = []
    out.reserveCapacity(flat.count / 6)
    var i = 0
    while i + 5 < flat.count {
      let startByte = UInt32(flat[i] * 2)
      let endByte = UInt32(flat[i + 1] * 2)
      let start = TSPoint(row: UInt32(flat[i + 2]), column: UInt32(flat[i + 3] * 2))
      let end = TSPoint(row: UInt32(flat[i + 4]), column: UInt32(flat[i + 5] * 2))
      out.append(TSRange(start_point: start, end_point: end, start_byte: startByte, end_byte: endByte))
      i += 6
    }
    return out
  }

  static func flatten(_ ranges: UnsafeMutablePointer<TSRange>, _ count: Int) -> [Int] {
    var out: [Int] = []
    out.reserveCapacity(count * 6)
    for i in 0..<count {
      let r = ranges[i]
      out.append(Int(r.start_byte) / 2)
      out.append(Int(r.end_byte) / 2)
      out.append(Int(r.start_point.row))
      out.append(Int(r.start_point.column) / 2)
      out.append(Int(r.end_point.row))
      out.append(Int(r.end_point.column) / 2)
    }
    return out
  }

  static func string(_ pointer: UnsafePointer<CChar>?, _ length: UInt32) -> String {
    guard let pointer else { return "" }
    return String(decoding: UnsafeRawBufferPointer(start: pointer, count: Int(length)), as: UTF8.self)
  }
}
