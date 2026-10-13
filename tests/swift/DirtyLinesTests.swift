import XCTest

@testable import Codepad

final class DirtyLinesTests: XCTestCase {
  private let doc = Document("let a = 1;\nlet b = 2;\nlet c = 3;\n")

  // The regression this design removes: every visible line re-queried for a one line edit.
  func testAnEditOnOneLineLeavesTheOtherVisibleLinesAlone() {
    XCTAssertEqual(dirtyRuns(first: 0, last: 2, revision: 2, applied: 1, changed: [19, 20], doc: doc) { _ in 1 }, [1, 1])
  }

  // A deletion's empty span and a region ending on a newline still name their line.
  func testARegionAtALineEndAndAnEmptyRegionDirtyTheirLines() {
    XCTAssertEqual(dirtyRuns(first: 0, last: 2, revision: 2, applied: 1, changed: [10, 11], doc: doc) { _ in 1 }, [0, 0])
    XCTAssertEqual(dirtyRuns(first: 0, last: 2, revision: 2, applied: 1, changed: [11, 11], doc: doc) { _ in 1 }, [1, 1])
    XCTAssertEqual(dirtyRuns(first: 0, last: 2, revision: 2, applied: 1, changed: [5, 25], doc: doc) { _ in 1 }, [0, 2])
    XCTAssertEqual(
      dirtyRuns(first: 0, last: 2, revision: 2, applied: 1, changed: [3, 4, 30, 31], doc: doc) { _ in 1 }, [0, 0, 2, 2])
  }

  // Lines the regions cannot vouch for: never laid out, laid out plain, or older than the applied snapshot; and no regions at all.
  func testAMissingPlainOrOlderEntryIsDirtyWithoutARegion() {
    let revisions: [Int: Int?] = [0: nil, 1: -1, 2: 0]
    XCTAssertEqual(dirtyRuns(first: 0, last: 2, revision: 2, applied: 1, changed: [], doc: doc) { revisions[$0] ?? nil }, [0, 2])
    XCTAssertEqual(dirtyRuns(first: 0, last: 2, revision: 2, applied: 1, changed: nil, doc: doc) { _ in 1 }, [0, 2])
    XCTAssertEqual(dirtyRuns(first: 0, last: 2, revision: 2, applied: 1, changed: nil, doc: doc) { _ in 2 }, [])
  }
}
