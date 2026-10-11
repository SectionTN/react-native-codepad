import CoreGraphics
import XCTest

@testable import Codepad

final class RangeRectsTests: XCTestCase {
  /// Monospace lines at 10 pt per character, `perRow` characters per row when wrapping.
  private final class Fake: RowGeometry {
    let lines: [String]
    let perRow: Int
    let viewHeight: Int
    let rowHeight = 20
    let spaceWidth: CGFloat = 10
    let originX: CGFloat = 0
    private var starts: [Int] = []

    init(_ lines: [String], perRow: Int = 1_000_000, viewHeight: Int = 1000) {
      self.lines = lines
      self.perRow = perRow
      self.viewHeight = viewHeight
      var offset = 0
      for line in lines {
        starts.append(offset)
        offset += line.utf16.count + 1
      }
    }

    func lineAt(_ offset: Int) -> Int {
      var line = 0
      while line + 1 < lines.count && starts[line + 1] <= offset { line += 1 }
      return line
    }

    func lineStart(_ line: Int) -> Int { starts[line] }
    func lineLength(_ line: Int) -> Int { lines[line].utf16.count }
    func lineTop(_ line: Int) -> Int { (0..<line).reduce(0) { $0 + rowCount($1) } * rowHeight }
    func rowCount(_ line: Int) -> Int { max(1, (lineLength(line) + perRow - 1) / perRow) }

    func rowSpans(line: Int, from: Int, to: Int, _ out: (Int, CGFloat, CGFloat) -> Void) {
      let firstRow = min(from / perRow, rowCount(line) - 1)
      let lastRow = min(to / perRow, rowCount(line) - 1)
      for row in firstRow...lastRow {
        let rowStart = row * perRow
        let rowEnd = min(lineLength(line), rowStart + perRow)
        let left = row == firstRow ? CGFloat(from - rowStart) * 10 : 0
        let right = row == lastRow ? CGFloat(to - rowStart) * 10 : CGFloat(rowEnd - rowStart) * 10
        out(row, left, right)
      }
    }
  }

  private func rects(_ g: RowGeometry, _ start: Int, _ end: Int, firstLine: Int = 0) -> [[CGFloat]] {
    var out: [[CGFloat]] = []
    RangeRects.forEach(g, start: start, end: end, firstLine: firstLine) { l, t, r, b in out.append([l, t, r, b]) }
    return out
  }

  private func rect(_ l: Int, _ t: Int, _ r: Int, _ b: Int) -> [CGFloat] { [CGFloat(l), CGFloat(t), CGFloat(r), CGFloat(b)] }

  func testSingleLineRange() {
    XCTAssertEqual(rects(Fake(["abcdef"]), 1, 3), [rect(10, 0, 30, 20)])
  }

  func testMultiLineRangeAddsTheNewlineWidthOnMiddleLines() {
    XCTAssertEqual(rects(Fake(["ab", "cd", "ef"]), 1, 7), [rect(10, 0, 30, 20), rect(0, 20, 30, 40), rect(0, 40, 10, 60)])
  }

  func testRangeEndingAtLineStartPaintsNothingThere() {
    XCTAssertEqual(rects(Fake(["ab", "cd"]), 0, 3), [rect(0, 0, 30, 20)])
  }

  func testEmptyMiddleLineStillShowsItsNewline() {
    XCTAssertEqual(rects(Fake(["a", "", "b"]), 0, 4), [rect(0, 0, 20, 20), rect(0, 20, 10, 40), rect(0, 40, 10, 60)])
  }

  func testLinesAboveFirstLineAreSkipped() {
    XCTAssertEqual(rects(Fake(["ab", "cd"]), 0, 4, firstLine: 1), [rect(0, 20, 10, 40)])
    // A selection entirely above the first visible line must not form an empty closed range.
    XCTAssertEqual(rects(Fake(["ab", "cd", "ef"]), 0, 2, firstLine: 2), [])
  }

  func testStopsAtTheViewBottom() {
    XCTAssertEqual(rects(Fake(["ab", "cd"], viewHeight: 20), 0, 4), [rect(0, 0, 30, 20)])
  }

  func testWrappedRowsUseTheRowOffsets() {
    XCTAssertEqual(rects(Fake(["abcdef"], perRow: 3), 1, 5), [rect(10, 0, 30, 20), rect(0, 20, 20, 40)])
  }
}
