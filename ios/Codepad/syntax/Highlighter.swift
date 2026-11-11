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
