import XCTest

@testable import Codepad

final class DocumentTests: XCTestCase {
  func testEmptyDocumentHasOneLine() {
    let d = Document()
    XCTAssertEqual(d.lineCount, 1)
    XCTAssertEqual(d.length, 0)
    XCTAssertEqual(d.revision, 0)
  }

  func testLineBreaksNormalizeOnLoadAndReplace() {
    let d = Document("a\r\nb\rc")
    XCTAssertEqual(d.text(), "a\nb\nc")
    _ = d.replace(5, 5, "\r\nd")
    XCTAssertEqual(d.text(), "a\nb\nc\nd")
    XCTAssertEqual(d.lineCount, 4)
  }

  func testReplaceAcrossLinesUpdatesCountLengthAndRevision() {
    let d = Document("one\ntwo\nthree")
    let c = d.replace(2, 9, "")
    XCTAssertEqual(d.text(), "onhree")
    XCTAssertEqual(d.lineCount, 1)
    XCTAssertEqual(d.length, 6)
    XCTAssertEqual(c.removed, "e\ntwo\nt")
    XCTAssertEqual(c.revision, 1)
  }

  func testLineStartsRecomputeAfterAnEdit() {
    let d = Document("ab\ncd\nef")
    XCTAssertEqual(d.lineStart(2), 6)
    _ = d.replace(0, 0, "xyz\n")
    XCTAssertEqual(d.lineStart(2), 7)
    XCTAssertEqual(d.lineStart(3), 10)
  }

  func testPositionsClampAtBothEnds() {
    let d = Document("ab\ncd")
    XCTAssertEqual(d.offsetToPosition(-3), Position(line: 0, column: 0))
    XCTAssertEqual(d.offsetToPosition(99), Position(line: 1, column: 2))
    XCTAssertEqual(d.positionToOffset(line: 9, column: 9), 5)
    XCTAssertEqual(d.positionToOffset(line: 0, column: 9), 2)
  }

  func testOffsetsCountUtf16Units() {
    let d = Document("a\u{1F600}b")
    XCTAssertEqual(d.length, 4)
    XCTAssertEqual(d.text(1, 3), "\u{1F600}")
    XCTAssertEqual(d.unit(at: 1), 0xD83D)
    XCTAssertEqual(d.unit(at: 4), 10)
  }

  func testRangesClampAndSwap() {
    let d = Document("abc")
    let c = d.replace(5, 1, "Z")
    XCTAssertEqual(d.text(), "aZ")
    XCTAssertEqual(c.start, 1)
    XCTAssertEqual(c.end, 3)
  }
}
