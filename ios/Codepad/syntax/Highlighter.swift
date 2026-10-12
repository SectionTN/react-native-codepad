import Foundation

/// Turns query captures from a snapshot into per line (startColumn, endColumn, styleId) triples.
class Highlighter {
  private struct Hit {
    let start: Int
    let end: Int
    let styleId: Int
    let layer: Int
    let pattern: Int
    let order: Int
  }

  // nvim reads spell and conceal as editor hints. They never carry a color.
  private static let markers: Set<String> = ["spell", "nospell", "conceal"]

  private let language: LoadedLanguage

  init(language: LoadedLanguage) {
    self.language = language
  }

  func spans(snapshot: Snapshot, doc: Document, firstLine: Int, lastLine: Int) -> [[Int]] {
    let rangeStart = doc.lineStart(firstLine)
    let rangeEnd = doc.lineEnd(lastLine)
    var hits: [Hit] = []
    collect(language.highlights, snapshot.tree, doc, rangeStart, rangeEnd, 0, 0, &hits)
    // The list is sorted by start: skip trees ending before the range, stop at the first one starting past it.
    for (i, inj) in snapshot.injected.enumerated() {
      if inj.end <= rangeStart { continue }
      if inj.start >= rangeEnd { break }
      collect(inj.language.highlights, inj.tree, doc, rangeStart, rangeEnd, i + 1, inj.shift, &hits)
    }
    // Same precedence as nvim: injections paint over the host, then later starts win, then later patterns.
    hits.sort { a, b in
      if a.layer != b.layer { return a.layer < b.layer }
      if a.start != b.start { return a.start < b.start }
      if a.pattern != b.pattern { return a.pattern < b.pattern }
      return a.order < b.order
    }
    let lineCount = lastLine - firstLine + 1
    var paint = (0..<lineCount).map { [Int](repeating: -1, count: doc.lineLength(firstLine + $0)) }
    for h in hits {
      let s = max(h.start, rangeStart)
      let e = min(h.end, rangeEnd)
      if s >= e { continue }
      var line = doc.lineAt(s)
      while line <= lastLine {
        let ls = doc.lineStart(line)
        let from = max(s, ls) - ls
        let to = min(e, doc.lineEnd(line)) - ls
        let row = line - firstLine
        let limit = min(to, paint[row].count)
        if from < limit {
          for c in from..<limit { paint[row][c] = h.styleId }
        }
        if e <= doc.lineEnd(line) + 1 { break }
        line += 1
      }
    }
    return paint.map { encode($0) }
  }

  /// Queries [start, end) of the document; a tree whose positions lag the document by `shift` is read in its own units.
  private func collect(
    _ compiled: CompiledQuery, _ tree: Tree, _ doc: Document, _ start: Int, _ end: Int, _ layer: Int, _ shift: Int,
    _ out: inout [Hit]
  ) {
    let read: (Node) -> String = { n in doc.text(n.startUnit + shift, n.endUnit + shift) }
    let cursor = QueryCursor()
    cursor.exec(compiled.query, tree.rootNode)
    cursor.setUnitRange(max(0, start - shift), end - shift)
    var rejected = Set<Int>()
    var accepted = Set<Int>()
    while let capture = cursor.nextCapture() {
      if rejected.contains(capture.matchId) { continue }
      if !accepted.contains(capture.matchId) && compiled.evaluator.hasPredicates(capture.patternIndex) {
        let all = (0..<cursor.matchCaptureCount).map { i -> CaptureNode in
          let c = cursor.matchCapture(i)
          return CaptureNode(captureIndex: c.captureIndex, node: c.node)
        }
        if !compiled.evaluator.matches(capture.patternIndex, captures: all, text: read) {
          rejected.insert(capture.matchId)
          cursor.removeMatch(capture.matchId)
          continue
        }
        accepted.insert(capture.matchId)
      }
      let name = compiled.query.captureNames[capture.captureIndex]
      if name.hasPrefix("_") || Highlighter.markers.contains(name) { continue }
      let style = name == "none" ? -1 : compiled.styleIds[capture.captureIndex]
      out.append(
        Hit(
          start: capture.node.startUnit + shift, end: capture.node.endUnit + shift, styleId: style, layer: layer,
          pattern: capture.patternIndex, order: out.count))
    }
  }

  private func encode(_ row: [Int]) -> [Int] {
    var out: [Int] = []
    var i = 0
    while i < row.count {
      let style = row[i]
      var j = i + 1
      while j < row.count && row[j] == style { j += 1 }
      if style >= 0 {
        out.append(i)
        out.append(j)
        out.append(style)
      }
      i = j
    }
    return out
  }
}
