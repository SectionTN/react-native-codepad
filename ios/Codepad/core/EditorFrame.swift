import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// One draw's reads from the core: the document and selection header, the window's line starts, and the lines to
/// lay out with their spans and text.
struct EditorFrame {
  let revision: Int
  let length: Int
  let lineCount: Int
  let anchor: Int
  let head: Int
  let caretLine: Int
  let decorationsVersion: Int
  let history: Int
  /// The window, clamped to the document.
  let first: Int
  let last: Int
  /// Flat inclusive [lo, hi, ...]: the lines to lay out.
  let runs: [Int]
  /// One entry per run line, in order. Empty for every line when the frame had no usable snapshot.
  let spans: [[Int]]
  fileprivate let starts: [Int]
  fileprivate let texts: [Int: [UInt16]]

  /// first...last + 1. The line after the last one starts at length + 1.
  func lineStart(_ line: Int) -> Int? {
    line >= first && line <= last + 1 ? starts[line - first] : nil
  }

  func lineLength(_ line: Int) -> Int? {
    line >= first && line <= last ? starts[line + 1 - first] - starts[line - first] - 1 : nil
  }

  /// nil for an offset outside the window.
  func lineAt(_ offset: Int) -> Int? {
    guard offset >= starts[0], offset < starts[starts.count - 1] else { return nil }
    var lo = 0
    var hi = starts.count - 1
    while lo + 1 < hi {
      let mid = (lo + hi) / 2
      if starts[mid] <= offset { lo = mid } else { hi = mid }
    }
    return first + lo
  }

  /// The text of a run line.
  func text(_ line: Int) -> [UInt16]? { texts[line] }
}

/// Makes the frame call, with buffers kept across draws and grown when the core asks for more.
final class FrameReader {
  private var ints: [Int32]
  private var units: [UInt16]

  init(ints: Int = 4096, units: Int = 16384) {
    self.ints = [Int32](repeating: 0, count: max(ints, 1))
    self.units = [UInt16](repeating: 0, count: max(units, 1))
  }

  func read(
    core: EditorCore, snapshot: Snapshot?, first: Int, last: Int, applied: Int, useChanged: Bool, entries: [Int32]
  ) -> EditorFrame {
    while true {
      var textLength: UInt32 = 0
      let needed = call(core, snapshot, first, last, applied, useChanged, entries, &textLength)
      let fits = Int(needed) <= ints.count && Int(textLength) <= units.count
      if fits { return decode(first, last) }
      if Int(needed) > ints.count { ints = [Int32](repeating: 0, count: Int(needed)) }
      if Int(textLength) > units.count { units = [UInt16](repeating: 0, count: Int(textLength)) }
    }
  }

  private func call(
    _ core: EditorCore, _ snapshot: Snapshot?, _ first: Int, _ last: Int, _ applied: Int, _ useChanged: Bool,
    _ entries: [Int32], _ textLength: inout UInt32
  ) -> UInt32 {
    let handle: OpaquePointer = core.document.handle
    let snap: OpaquePointer? = snapshot?.pointer
    let firstLine = Int32(clamping: first)
    let lastLine = Int32(clamping: last)
    let appliedRevision = Int32(clamping: applied)
    let changed: Int32 = useChanged ? 1 : 0
    var length: UInt32 = 0
    let needed: UInt32 = entries.withUnsafeBufferPointer { e in
      ints.withUnsafeMutableBufferPointer { o in
        units.withUnsafeMutableBufferPointer { t in
          let intCap = UInt32(o.count)
          let textCap = UInt32(t.count)
          return cp_editor_frame(
            handle, snap, firstLine, lastLine, appliedRevision, changed, e.baseAddress, o.baseAddress, intCap,
            t.baseAddress, textCap, &length)
        }
      }
    }
    textLength = length
    return needed
  }

  private func decode(_ first: Int, _ last: Int) -> EditorFrame {
    var i = 0
    func next() -> Int {
      let v = Int(ints[i])
      i += 1
      return v
    }
    let revision = next()
    let length = next()
    let lineCount = next()
    let anchor = next()
    let head = next()
    let caretLine = next()
    let decorationsVersion = next()
    let history = next()
    let lo = min(max(first, 0), lineCount - 1)
    let hi = min(max(last, lo), lineCount - 1)
    var starts: [Int] = []
    starts.reserveCapacity(hi - lo + 2)
    for _ in lo...(hi + 1) { starts.append(next()) }
    let runCount = next()
    var runs: [Int] = []
    for _ in 0..<(runCount * 2) { runs.append(next()) }
    var runLines: [Int] = []
    var r = 0
    while r + 1 < runs.count {
      for line in runs[r]...runs[r + 1] { runLines.append(line) }
      r += 2
    }
    var spans: [[Int]] = []
    spans.reserveCapacity(runLines.count)
    for _ in runLines {
      let triples = next()
      var row: [Int] = []
      row.reserveCapacity(triples * 3)
      for _ in 0..<(triples * 3) { row.append(next()) }
      spans.append(row)
    }
    var texts: [Int: [UInt16]] = [:]
    for line in runLines {
      let offset = next()
      let count = next()
      texts[line] = count == 0 ? [] : Array(units[offset..<(offset + count)])
    }
    return EditorFrame(
      revision: revision, length: length, lineCount: lineCount, anchor: anchor, head: head, caretLine: caretLine,
      decorationsVersion: decorationsVersion, history: history, first: lo, last: hi, runs: runs, spans: spans,
      starts: starts, texts: texts)
  }
}
