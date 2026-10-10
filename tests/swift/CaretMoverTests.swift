import CoreGraphics
import XCTest

@testable import Codepad

final class CaretMoverTests: XCTestCase {
  /// Monospace rows of `width` columns, 10 pt per char.
  private final class Mono: LineGeometry {
    let doc: Document
    let width: Int

    init(_ doc: Document, _ width: Int) {
      self.doc = doc
      self.width = width
    }

    func rows(_ line: Int) -> Int { max(1, (doc.lineLength(line) + width - 1) / width) }
    func rowOf(line: Int, column: Int) -> Int { min(column / width, rows(line) - 1) }
    func caretX(line: Int, column: Int) -> CGFloat { CGFloat(column - rowOf(line: line, column: column) * width) * 10 }

    func columnAt(line: Int, row: Int, x: CGFloat) -> Int {
      let rowEnd = min(doc.lineLength(line), (row + 1) * width)
      return min(rowEnd, row * width + Int((x / 10).rounded()))
    }
  }

  func testDownKeepsTheGoalColumnAcrossShortLines() {
    let doc = Document("abcdef\nxy\nlonger line")
    let g = Mono(doc, 100)
    let first = CaretMover.move(doc: doc, geometry: g, offset: 4, rows: 1, goalX: nil)
    XCTAssertEqual(first.offset, doc.lineStart(1) + 2)
    XCTAssertEqual(first.goalX, 40)
    let second = CaretMover.move(doc: doc, geometry: g, offset: first.offset, rows: 1, goalX: first.goalX)
    XCTAssertEqual(second.offset, doc.lineStart(2) + 4)
    XCTAssertEqual(second.goalX, 40)
  }

  func testUpAndDownCrossWrappedRows() {
    let doc = Document("abcdefgh\nij")
    let g = Mono(doc, 4)
    XCTAssertEqual(CaretMover.move(doc: doc, geometry: g, offset: 1, rows: 1, goalX: nil).offset, 5)
    XCTAssertEqual(CaretMover.move(doc: doc, geometry: g, offset: 5, rows: 1, goalX: nil).offset, doc.lineStart(1) + 1)
    XCTAssertEqual(CaretMover.move(doc: doc, geometry: g, offset: 5, rows: -1, goalX: nil).offset, 1)
    XCTAssertEqual(CaretMover.move(doc: doc, geometry: g, offset: doc.lineStart(1) + 1, rows: -1, goalX: nil).offset, 5)
  }

  func testPagesMoveSeveralRows() {
    let doc = Document("a\nb\nc\nd\ne")
    let g = Mono(doc, 100)
    XCTAssertEqual(CaretMover.move(doc: doc, geometry: g, offset: 0, rows: 3, goalX: nil).offset, doc.lineStart(3))
    XCTAssertEqual(CaretMover.move(doc: doc, geometry: g, offset: doc.lineStart(3), rows: -2, goalX: nil).offset, doc.lineStart(1))
  }

  func testPastTheEndsClampsToTheDocument() {
    let doc = Document("ab\ncd")
    let g = Mono(doc, 100)
    XCTAssertEqual(CaretMover.move(doc: doc, geometry: g, offset: 1, rows: -1, goalX: nil).offset, 0)
    XCTAssertEqual(CaretMover.move(doc: doc, geometry: g, offset: 1, rows: 5, goalX: nil).offset, doc.length)
    XCTAssertEqual(CaretMover.move(doc: doc, geometry: g, offset: 1, rows: -1, goalX: nil).goalX, 10)
  }
}
