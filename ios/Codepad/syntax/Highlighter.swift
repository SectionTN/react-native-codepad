import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// Turns a snapshot into per line (startColumn, endColumn, styleId) triples through the core.
class Highlighter: @unchecked Sendable {
  let language: LoadedLanguage
  // Reused across calls on the main thread; grown when the core asks for more.
  private var buffer = [Int32](repeating: 0, count: 4096)

  init(language: LoadedLanguage) { self.language = language }

  func spans(snapshot: Snapshot, doc: Document, firstLine: Int, lastLine: Int) -> [[Int]] {
    let start = UInt32(doc.lineStart(firstLine))
    let count = fill { cp_highlight(snapshot.pointer, Int32(firstLine), Int32(lastLine), start, $0, $1) }
    var i = 0
    return lines(lastLine - firstLine + 1, &i, count)
  }

  /// One draw's dirty runs, flat inclusive [lo, hi, ...], and the spans of every line in them, in order.
  func frame(
    snapshot: Snapshot, doc: Document, first: Int, last: Int, applied: Int, useChanged: Bool, entries: [Int32]
  ) -> (runs: [Int], spans: [[Int]]) {
    let start = UInt32(doc.lineStart(first))
    let count = entries.withUnsafeBufferPointer { e in
      fill {
        cp_frame(
          snapshot.pointer, Int32(first), Int32(last), start, Int32(applied), useChanged ? 1 : 0, e.baseAddress, $0, $1)
      }
    }
    guard count > 0 else { return ([], []) }
    let runCount = Int(buffer[0])
    let runs = (0..<runCount * 2).map { Int(buffer[1 + $0]) }
    var lineCount = 0
    for r in 0..<runCount { lineCount += runs[r * 2 + 1] - runs[r * 2] + 1 }
    var i = 1 + runCount * 2
    return (runs, lines(lineCount, &i, count))
  }

  /// Calls a core entry point that writes ints, growing the buffer once when it is short.
  private func fill(_ call: (UnsafeMutablePointer<Int32>?, UInt32) -> UInt32) -> Int {
    var needed = buffer.withUnsafeMutableBufferPointer { call($0.baseAddress, UInt32($0.count)) }
    if needed > buffer.count {
      buffer = [Int32](repeating: 0, count: Int(needed))
      needed = buffer.withUnsafeMutableBufferPointer { call($0.baseAddress, UInt32($0.count)) }
    }
    return Int(needed)
  }

  /// Decodes n lines of (count, triples...) from the buffer starting at i.
  private func lines(_ n: Int, _ i: inout Int, _ count: Int) -> [[Int]] {
    var out: [[Int]] = []
    out.reserveCapacity(n)
    for _ in 0..<n {
      guard i < count else {
        out.append([])
        continue
      }
      let triples = Int(buffer[i])
      i += 1
      var row: [Int] = []
      row.reserveCapacity(triples * 3)
      for k in 0..<triples * 3 { row.append(Int(buffer[i + k])) }
      i += triples * 3
      out.append(row)
    }
    return out
  }
}
