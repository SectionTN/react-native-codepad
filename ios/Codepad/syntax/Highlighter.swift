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
    let read: (Node) -> String = { n in doc.text(n.startUnit, n.endUnit) }
    collect(language.highlights, snapshot.tree, rangeStart, rangeEnd, read, 0, &hits)
    for (i, inj) in snapshot.injected.enumerated() {
      collect(inj.language.highlights, inj.tree, rangeStart, rangeEnd, read, i + 1, &hits)
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

  private func collect(
    _ compiled: CompiledQuery, _ tree: Tree, _ start: Int, _ end: Int, _ read: (Node) -> String, _ layer: Int,
    _ out: inout [Hit]
  ) {
    let cursor = QueryCursor()
    cursor.exec(compiled.query, tree.rootNode)
    cursor.setUnitRange(start, end)
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
          start: capture.node.startUnit, end: capture.node.endUnit, styleId: style, layer: layer,
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
