import CoreGraphics

/// What a row walk needs from the view: line lookup, row placement and the horizontal extent of a row span.
protocol RowGeometry: AnyObject {
  var rowHeight: Int { get }
  var spaceWidth: CGFloat { get }
  var viewHeight: Int { get }
  /// x of column 0 in view space.
  var originX: CGFloat { get }
  func lineAt(_ offset: Int) -> Int
  func lineStart(_ line: Int) -> Int
  func lineLength(_ line: Int) -> Int
  func lineTop(_ line: Int) -> Int
  /// 0 when the line has no layout yet.
  func rowCount(_ line: Int) -> Int
  func rowSpans(line: Int, from: Int, to: Int, _ out: (_ row: Int, _ left: CGFloat, _ right: CGFloat) -> Void)
}

enum RangeRects {
  /// Calls `out` once per row rect of [start, end) from `firstLine` down to the view bottom. The last row of
  /// every line but the last one gets a space of width so the newline shows; empty spans are skipped.
  static func forEach(
    _ g: RowGeometry, start: Int, end: Int, firstLine: Int,
    _ out: (_ left: CGFloat, _ top: CGFloat, _ right: CGFloat, _ bottom: CGFloat) -> Void
  ) {
    let startLine = g.lineAt(start)
    let endLine = g.lineAt(end)
    if endLine < firstLine { return }
    for line in max(startLine, firstLine)...endLine {
      let top = g.lineTop(line)
      if top >= g.viewHeight { break }
      let rows = g.rowCount(line)
      if rows == 0 { break }
      let ls = g.lineStart(line)
      let from = line == startLine ? start - ls : 0
      let to = line == endLine ? end - ls : g.lineLength(line)
      let lastRow = rows - 1
      g.rowSpans(line: line, from: from, to: to) { row, left, right in
        let r = line != endLine && row == lastRow ? right + g.spaceWidth : right
        if r > left {
          let y = CGFloat(top + row * g.rowHeight)
          out(g.originX + left, y, g.originX + r, y + CGFloat(g.rowHeight))
        }
      }
    }
  }
}
