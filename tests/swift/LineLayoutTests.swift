import CoreGraphics
import CoreText
import XCTest

@testable import Codepad

final class LineLayoutTests: XCTestCase {
  private struct NoStyles: StyleResolver {
    func style(_ id: Int) -> TokenStyle? { nil }
  }

  private let font = CTFontCreateWithName("Menlo" as CFString, 14, nil)
  private lazy var metrics = RowMetrics(font: font, lineHeight: 1.4, tabSize: 4)

  private func layout(_ text: String, wrapWidth: Int = 0, spans: [Int] = []) -> LineLayout {
    LineLayout(
      text: Array(text.utf16), spans: spans, font: font, styles: NoStyles(), foreground: ThemeColors.default.foreground,
      metrics: metrics, wrapWidth: wrapWidth)
  }

  private var charWidth: CGFloat { metrics.spaceWidth }

  func testRowHeightIsRoundedFontSizeTimesLineHeight() {
    XCTAssertEqual(metrics.rowHeight, 20)
    XCTAssertEqual(metrics.ascent + metrics.descent, 20, accuracy: 1)
  }

  func testWrapOffIsOneRow() {
    let l = layout(String(repeating: "x", count: 60))
    XCTAssertEqual(l.rowCount, 1)
    XCTAssertEqual(l.length, 60)
    XCTAssertEqual(l.width(), charWidth * 60, accuracy: 0.5)
  }

  func testWrapOnBreaksAtTheWidth() {
    let l = layout(String(repeating: "x", count: 60), wrapWidth: Int((charWidth * 20.5).rounded(.up)))
    XCTAssertEqual(l.rowCount, 3)
    var covered = 0
    for row in 0..<l.rowCount {
      let (start, end) = l.rowRange(row)
      XCTAssertEqual(start, covered)
      covered = end
    }
    XCTAssertEqual(covered, 60)
    XCTAssertEqual(l.rowOf(0), 0)
    XCTAssertEqual(l.rowOf(25), 1)
    XCTAssertEqual(l.rowOf(60), 2)
  }

  func testCaretXIsMonotonicInTheColumn() {
    let l = layout("let x = 1; // hi")
    var last: CGFloat = -1
    for column in 0...l.length {
      let x = l.caretX(column)
      XCTAssertGreaterThan(x, last)
      last = x
    }
    XCTAssertEqual(l.caretX(0), 0)
    XCTAssertEqual(l.caretX(l.length), charWidth * CGFloat(l.length), accuracy: 0.5)
  }

  func testColumnAtRoundTripsCaretX() {
    let l = layout("abcdefghij", wrapWidth: Int((charWidth * 4.5).rounded(.up)))
    XCTAssertEqual(l.rowCount, 3)
    for column in 0...l.length {
      let row = l.rowOf(column)
      XCTAssertEqual(l.columnAt(row: row, x: l.caretX(column) + 1), column)
    }
    XCTAssertEqual(l.columnAt(row: 0, x: -50), 0)
    XCTAssertEqual(l.columnAt(row: 2, x: 5000), 10)
  }

  func testTabsStopAtMultiplesOfTheTabWidth() {
    let l = layout("\ta\tb")
    XCTAssertEqual(l.caretX(1), CGFloat(metrics.tabWidth), accuracy: 0.5)
    XCTAssertEqual(l.caretX(3), CGFloat(metrics.tabWidth * 2), accuracy: 0.5)
  }

  func testASurrogatePairSnapsTheCaretToAnEdge() {
    let emoji = layout("a\u{1F600}b")
    let ascii = layout("aXb")
    XCTAssertGreaterThan(emoji.width(), ascii.width())
    XCTAssertTrue(emoji.caretX(2) == emoji.caretX(1) || emoji.caretX(2) == emoji.caretX(3))
  }

  func testSelectionRowsCoverEachVisualRow() {
    let l = layout("abcdefghij", wrapWidth: Int((charWidth * 4.5).rounded(.up)))
    var rows: [(Int, CGFloat, CGFloat)] = []
    l.selectionRows(from: 1, to: 9) { rows.append(($0, $1, $2)) }
    XCTAssertEqual(rows.map { $0.0 }, [0, 1, 2])
    XCTAssertEqual(rows[0].1, charWidth, accuracy: 0.5)
    XCTAssertEqual(rows[0].2, charWidth * 4, accuracy: 0.5)
    XCTAssertEqual(rows[1].1, 0)
    XCTAssertEqual(rows[1].2, charWidth * 4, accuracy: 0.5)
    XCTAssertEqual(rows[2].1, 0)
    XCTAssertEqual(rows[2].2, charWidth, accuracy: 0.5)
  }
}
