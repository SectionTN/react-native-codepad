import Foundation

/// Answers whether an offset sits in a string or a comment from the highlighter's own captures, computed
/// in windows of `windowLines` lines as the bracket scan moves. One instance serves one scan.
final class SpanWindow {
  private let snapshot: Snapshot
  private let highlighter: Highlighter
  private let doc: Document
  private let windowLines: Int
  private var windows: [Int: [[Int]]] = [:]

  init(snapshot: Snapshot, highlighter: Highlighter, doc: Document, windowLines: Int = 256) {
    self.snapshot = snapshot
    self.highlighter = highlighter
    self.doc = doc
    self.windowLines = windowLines
  }

  func skip(_ offset: Int) -> Bool {
    let line = doc.lineAt(offset)
    let index = line / windowLines
    let lo = index * windowLines
    let spans: [[Int]]
    if let cached = windows[index] {
      spans = cached
    } else {
      spans = highlighter.spans(snapshot: snapshot, doc: doc, firstLine: lo, lastLine: min(doc.lineCount - 1, lo + windowLines - 1))
      windows[index] = spans
    }
    let runs = spans[line - lo]
    let column = offset - doc.lineStart(line)
    var i = 0
    while i < runs.count {
      if column < runs[i] { return false }
      if column < runs[i + 1] {
        let name = StyleTable.name(runs[i + 2])
        return name.hasPrefix("string") || name.hasPrefix("comment")
      }
      i += 3
    }
    return false
  }
}
