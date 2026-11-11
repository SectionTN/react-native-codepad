import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// The app's decorations in current document coordinates. The core maps their ranges and lines through every
/// edit. Colors, styles and sizes stay here, by the index the core carries. Main thread only.
final class DecorationSet {
  private let document: Document
  private var payloads: [Decoration] = []
  private var cached: [Decoration] = []
  private var cachedVersion: Int32 = -1

  init(_ document: Document) {
    self.document = document
  }

  /// Moves on every change.
  var version: Int { Int(cp_editor_decorations_version(document.handle)) }

  var items: [Decoration] {
    let current = cp_editor_decorations_version(document.handle)
    if current == cachedVersion { return cached }
    let count = Int(cp_editor_decorations(document.handle, nil, 0))
    let raw = count == 0 ? [] : [cp_decoration](unsafeUninitializedCapacity: count) { buffer, initialized in
      cp_editor_decorations(document.handle, buffer.baseAddress, UInt32(count))
      initialized = count
    }
    var out: [Decoration] = []
    out.reserveCapacity(count)
    for d in raw {
      switch payloads[Int(d.payload)] {
      case .underline(var u):
        u.start = Int(d.a)
        u.end = Int(d.b)
        out.append(.underline(u))
      case .gap:
        out.append(.gap(line: Int(d.a), rows: Int(d.b)))
      case .lineBackground(_, let color):
        out.append(.lineBackground(line: Int(d.a), color: color))
      }
    }
    cached = out
    cachedVersion = current
    return out
  }

  /// `revision` is the document revision the items were computed for, below zero for the current one. False when
  /// the edits since then are no longer known, which keeps the current set.
  func replace(_ list: [Decoration], revision: Int) -> Bool {
    var kept: [Decoration] = []
    var raw: [cp_decoration] = []
    for d in list {
      var item = cp_decoration()
      switch d {
      case .underline(let u):
        // A thickness of zero or less would never advance the wave.
        if u.thickness <= 0 { continue }
        item.kind = Int32(CP_DECORATION_UNDERLINE)
        item.a = Int32(clamping: u.start)
        item.b = Int32(clamping: u.end)
      case .gap(let line, let rows):
        item.kind = Int32(CP_DECORATION_GAP)
        item.a = Int32(clamping: line)
        item.b = Int32(clamping: rows)
      case .lineBackground(let line, _):
        item.kind = Int32(CP_DECORATION_LINE_BACKGROUND)
        item.a = Int32(clamping: line)
      }
      item.payload = Int32(kept.count)
      kept.append(d)
      raw.append(item)
    }
    let accepted = raw.withUnsafeBufferPointer {
      cp_editor_set_decorations(document.handle, $0.baseAddress, UInt32($0.count), Int32(clamping: revision))
    }
    if accepted != 0 { payloads = kept }
    return accepted != 0
  }

  /// Total gap rows per line, lines with a gap only.
  func gapRows() -> [Int: Int] {
    var out: [Int: Int] = [:]
    for d in items {
      if case .gap(let line, let rows) = d { out[line, default: 0] += rows }
    }
    return out
  }
}
