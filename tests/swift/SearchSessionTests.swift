import XCTest

@testable import Codepad

final class SearchSessionTests: XCTestCase {
  private func session(_ pairs: Int...) throws -> SearchSession {
    let query = SearchQuery(text: "x")
    let s = SearchSession(query: query, pattern: try Searcher.compile(query))
    s.matches = pairs
    s.revision = 0
    return s
  }

  func testIndexAtOrAfterIsABinarySearchOnStarts() throws {
    let s = try session(0, 1, 4, 5, 8, 9)
    XCTAssertEqual(s.indexAtOrAfter(2), 1)
    XCTAssertEqual(s.indexAtOrAfter(9), 3)
  }

  func testNextSkipsTheSelectedMatchAndWraps() throws {
    let s = try session(0, 1, 4, 5)
    XCTAssertEqual(s.nextIndex(Selection(anchor: 0, head: 1)), 1)
    XCTAssertEqual(s.nextIndex(Selection(anchor: 4, head: 5)), 0)
  }

  func testPreviousWraps() throws {
    let s = try session(0, 1, 4, 5)
    XCTAssertEqual(s.previousIndex(Selection(anchor: 0, head: 0)), 1)
  }

  func testEmptySessionReportsMinusOne() throws {
    XCTAssertEqual(try session().nextIndex(Selection(anchor: 0, head: 0)), -1)
  }

  func testMapThroughDropsATouchedMatchAndShiftsTheRest() {
    let change = Change(start: 4, removed: "x", inserted: "yyy", revision: 1)
    XCTAssertEqual(SearchSession.mapThrough([0, 1, 4, 5, 8, 9], change), [0, 1, 10, 11])
  }

  func testMapThroughShiftsAnInsertionAtTheMatchStart() {
    let change = Change(start: 4, removed: "", inserted: "zz", revision: 1)
    XCTAssertEqual(SearchSession.mapThrough([0, 1, 4, 5], change), [0, 1, 6, 7])
  }

  func testFirstEndingAfterFindsTheVisibleWindowStart() {
    XCTAssertEqual(SearchSession.firstEndingAfter([0, 2, 3, 5, 6, 8], 2), 1)
  }
}
