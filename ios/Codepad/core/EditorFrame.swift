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

  /// One frame call's buffers: the ints, their capacity, the text units, their capacity and the text length out.
  typealias Call = (
    UnsafeMutablePointer<Int32>?, UInt32, UnsafeMutablePointer<UInt16>?, UInt32, UnsafeMutablePointer<UInt32>
  ) -> UInt32

  /// The draw's frame: the layout picks the lines, `pairs` holds (line, revision) for each cached line in any order.
  func read(
    core: EditorCore, layout: Viewport, snapshot: Snapshot?, applied: Int, useChanged: Bool, pairs: [Int32]
  ) -> EditorFrame {
    let handle: OpaquePointer = core.document.handle
    let layoutHandle: OpaquePointer = layout.handle
    let snap: OpaquePointer? = snapshot?.pointer
    let appliedRevision = Int32(clamping: applied)
    let changed: Int32 = useChanged ? 1 : 0
    let pairCount = UInt32(pairs.count / 2)
    return read(window: nil) { out, cap, text, textCap, length in
      pairs.withUnsafeBufferPointer { p in
        cp_editor_frame(
          handle, layoutHandle, snap, appliedRevision, changed, p.baseAddress, pairCount, out, cap, text, textCap,
          length)
      }
    }
  }

  /// Makes `call` until both buffers fit, then decodes. `window` is the range a range call asked for.
  func read(window: (Int, Int)?, _ call: Call) -> EditorFrame {
    while true {
      var textLength: UInt32 = 0
      let needed: UInt32 = ints.withUnsafeMutableBufferPointer { o in
        units.withUnsafeMutableBufferPointer { t in
          let intCap = UInt32(o.count)
          let textCap = UInt32(t.count)
          return call(o.baseAddress, intCap, t.baseAddress, textCap, &textLength)
        }
      }
      let fits = Int(needed) <= ints.count && Int(textLength) <= units.count
      if fits { return decode(window) }
      if Int(needed) > ints.count { ints = [Int32](repeating: 0, count: Int(needed)) }
      if Int(textLength) > units.count { units = [UInt16](repeating: 0, count: Int(textLength)) }
    }
  }

  /// `window` is the range a range call asked for. The layout's call writes its own after the header.
  private func decode(_ window: (Int, Int)?) -> EditorFrame {
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
    let first = window?.0 ?? next()
    let last = window?.1 ?? next()
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
