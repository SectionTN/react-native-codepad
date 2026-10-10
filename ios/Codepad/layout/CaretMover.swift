import CoreGraphics

/// Visual rows of laid out lines, answered by the view from its layout cache.
protocol LineGeometry: AnyObject {
  func rows(_ line: Int) -> Int
  func rowOf(line: Int, column: Int) -> Int
  func caretX(line: Int, column: Int) -> CGFloat
  func columnAt(line: Int, row: Int, x: CGFloat) -> Int
}

/// Up, down and page movement by visual rows with a remembered goal x.
enum CaretMover {
  struct Result: Equatable {
    let offset: Int
    let goalX: CGFloat
  }

  /// Moves `rows` rows from `offset` (negative is up), clamping to the document ends.
  static func move(doc: Document, geometry: LineGeometry, offset: Int, rows: Int, goalX: CGFloat?) -> Result {
    let pos = doc.offsetToPosition(offset)
    var line = pos.line
    var row = geometry.rowOf(line: line, column: pos.column)
    let x = goalX ?? geometry.caretX(line: line, column: pos.column)
    var remaining = rows
    while remaining < 0 {
      if row > 0 {
        row -= 1
      } else {
        if line == 0 { return Result(offset: 0, goalX: x) }
        line -= 1
        row = geometry.rows(line) - 1
      }
      remaining += 1
    }
    while remaining > 0 {
      if row < geometry.rows(line) - 1 {
        row += 1
      } else {
        if line == doc.lineCount - 1 { return Result(offset: doc.length, goalX: x) }
        line += 1
        row = 0
      }
      remaining -= 1
    }
    return Result(offset: doc.lineStart(line) + geometry.columnAt(line: line, row: row, x: x), goalX: x)
  }
}
