import XCTest

@testable import Codepad

final class HeightMapTests: XCTestCase {
  func testUnmeasuredLinesCountOneRow() {
    let h = HeightMap(lineCount: 5)
    XCTAssertEqual(h.totalRows, 5)
    XCTAssertEqual(h.rowStart(3), 3)
    XCTAssertEqual(h.rowStart(5), 5)
    XCTAssertEqual(h.lineAtRow(4), 4)
    XCTAssertEqual(h.lineAtRow(99), 4)
    XCTAssertEqual(h.lineAtRow(-1), 0)
  }

  func testMeasuredRowsShiftLaterLines() {
    let h = HeightMap(lineCount: 5)
    XCTAssertEqual(h.setRows(1, 3), 1)
    XCTAssertEqual(h.setRows(1, 3), 3)
    XCTAssertEqual(h.totalRows, 7)
    XCTAssertEqual(h.rowStart(2), 4)
    XCTAssertEqual(h.lineAtRow(1), 1)
    XCTAssertEqual(h.lineAtRow(3), 1)
    XCTAssertEqual(h.lineAtRow(4), 2)
    XCTAssertEqual(h.lineAtRow(6), 4)
  }

  func testReplaceLinesKeepsTheTail() {
    let h = HeightMap(lineCount: 4)
    h.setRows(3, 2)
    h.replaceLines(first: 1, oldCount: 1, newCount: 3)
    XCTAssertEqual(h.lineCount, 6)
    XCTAssertEqual(h.rows(1), 1)
    XCTAssertEqual(h.rows(3), 1)
    XCTAssertEqual(h.rows(5), 2)
    XCTAssertEqual(h.totalRows, 7)
    h.replaceLines(first: 0, oldCount: 3, newCount: 1)
    XCTAssertEqual(h.lineCount, 4)
    XCTAssertEqual(h.rows(3), 2)
    XCTAssertEqual(h.totalRows, 5)
    XCTAssertEqual(h.rowStart(3), 3)
  }

  func testResetAllForgetsMeasurements() {
    let h = HeightMap(lineCount: 3)
    h.setRows(0, 4)
    XCTAssertEqual(h.totalRows, 6)
    h.resetAll()
    XCTAssertEqual(h.totalRows, 3)
    XCTAssertEqual(h.rowStart(1), 1)
  }

  func testGrowsPastTheInitialCapacity() {
    let h = HeightMap(lineCount: 1)
    h.replaceLines(first: 0, oldCount: 1, newCount: 40)
    XCTAssertEqual(h.lineCount, 40)
    XCTAssertEqual(h.totalRows, 40)
    XCTAssertEqual(h.rowStart(39), 39)
    h.replaceLines(first: 39, oldCount: 1, newCount: 30)
    XCTAssertEqual(h.lineCount, 69)
    XCTAssertEqual(h.totalRows, 69)
  }
}
