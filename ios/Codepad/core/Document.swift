import Foundation

/// Lines of UTF-16 units without terminators, so every offset is the index JavaScript strings use.
final class Document {
  private var lines: [[UInt16]] = []
  private var lineStarts = [Int](repeating: 0, count: 64)
  private var cleanLines = 0

  private(set) var length = 0
  private(set) var revision = 0

  init(_ initialText: String = "") {
    let text = Array(Document.normalizeNewlines(initialText).utf16)
    var from = 0
    while true {
      guard let nl = text[from...].firstIndex(of: 10) else {
        lines.append(Array(text[from...]))
        break
      }
      lines.append(Array(text[from..<nl]))
      from = nl + 1
    }
    length = text.count
  }

  var lineCount: Int { lines.count }

  func line(_ index: Int) -> [UInt16] {
    index >= 0 && index < lines.count ? lines[index] : []
  }

  func lineString(_ index: Int) -> String {
    String(decoding: line(index), as: UTF16.self)
  }

  func lineLength(_ index: Int) -> Int {
    index >= 0 && index < lines.count ? lines[index].count : 0
  }

  /// Start offset of line `index`. `index == lineCount` yields `length + 1` so the prefix sums stay uniform.
  func lineStart(_ index: Int) -> Int {
    let i = max(0, min(index, lines.count))
    ensureStarts(i)
    return lineStarts[i]
  }

  func lineEnd(_ index: Int) -> Int {
    lineStart(index) + lineLength(index)
  }

  func lineAt(_ offset: Int) -> Int {
    let o = max(0, min(offset, length))
    ensureStarts(lines.count - 1)
    var lo = 0
    var hi = lines.count - 1
    while lo < hi {
      let mid = (lo + hi + 1) >> 1
      if lineStarts[mid] <= o { lo = mid } else { hi = mid - 1 }
    }
    return lo
  }

  func offsetToPosition(_ offset: Int) -> Position {
    let o = max(0, min(offset, length))
    let line = lineAt(o)
    return Position(line: line, column: o - lineStart(line))
  }

  func positionToOffset(line: Int, column: Int) -> Int {
    let l = max(0, min(line, lines.count - 1))
    let c = max(0, min(column, lines[l].count))
    return lineStart(l) + c
  }

  /// The unit at `offset`, clamped into the document. A line end reads as the newline unit.
  func unit(at offset: Int) -> UInt16 {
    let o = max(0, min(offset, length))
    let line = lineAt(o)
    let col = o - lineStart(line)
    let units = lines[line]
    return col < units.count ? units[col] : 10
  }

  func text() -> String {
    text(0, length)
  }

  func text(_ start: Int, _ end: Int) -> String {
    let (s, e) = clamp(start, end)
    if s == e { return "" }
    let sl = lineAt(s)
    let el = lineAt(e)
    var out = [UInt16]()
    out.reserveCapacity(e - s)
    for line in sl...el {
      let from = line == sl ? s - lineStart(sl) : 0
      let to = line == el ? e - lineStart(el) : lines[line].count
      out.append(contentsOf: lines[line][from..<to])
      if line != el { out.append(10) }
    }
    return String(decoding: out, as: UTF16.self)
  }

  @discardableResult
  func replace(_ start: Int, _ end: Int, _ text: String) -> Change {
    let (s, e) = clamp(start, end)
    let inserted = Document.normalizeNewlines(text)
    let removed = self.text(s, e)
    let sl = lineAt(s)
    let sc = s - lineStart(sl)
    let el = lineAt(e)
    let ec = e - lineStart(el)
    let prefix = lines[sl][..<sc]
    let suffix = lines[el][ec...]
    let parts = inserted.utf16.split(separator: 10, omittingEmptySubsequences: false)
    var fresh = [[UInt16]]()
    fresh.reserveCapacity(parts.count)
    if parts.count == 1 {
      var only = Array(prefix)
      only.append(contentsOf: parts[0])
      only.append(contentsOf: suffix)
      fresh.append(only)
    } else {
      var first = Array(prefix)
      first.append(contentsOf: parts[0])
      fresh.append(first)
      for i in 1..<(parts.count - 1) { fresh.append(Array(parts[i])) }
      var last = Array(parts[parts.count - 1])
      last.append(contentsOf: suffix)
      fresh.append(last)
    }
    lines.replaceSubrange(sl...el, with: fresh)
    length += inserted.utf16.count - (e - s)
    // The start of the first touched line did not move, so its cached start stays valid.
    cleanLines = min(cleanLines, sl + 1)
    revision += 1
    return Change(start: s, removed: removed, inserted: inserted, revision: revision)
  }

  private func clamp(_ start: Int, _ end: Int) -> (Int, Int) {
    let s = max(0, min(start, length))
    let e = max(0, min(end, length))
    return s <= e ? (s, e) : (e, s)
  }

  private func ensureStarts(_ upTo: Int) {
    if lineStarts.count < lines.count + 1 {
      let grown = max(lines.count + 1, lineStarts.count * 2)
      lineStarts.append(contentsOf: repeatElement(0, count: grown - lineStarts.count))
    }
    if cleanLines == 0 {
      lineStarts[0] = 0
      cleanLines = 1
    }
    while cleanLines <= upTo {
      let i = cleanLines
      lineStarts[i] = lineStarts[i - 1] + lines[i - 1].count + 1
      cleanLines += 1
    }
  }

  /// `\r\n` and a lone `\r` become `\n`, on the units so a `\r\n` grapheme never hides the `\r`.
  static func normalizeNewlines(_ text: String) -> String {
    guard text.utf16.contains(13) else { return text }
    var out = [UInt16]()
    out.reserveCapacity(text.utf16.count)
    var afterCR = false
    for u in text.utf16 {
      if u == 13 {
        out.append(10)
        afterCR = true
        continue
      }
      if u == 10 && afterCR {
        afterCR = false
        continue
      }
      afterCR = false
      out.append(u)
    }
    return String(decoding: out, as: UTF16.self)
  }
}
