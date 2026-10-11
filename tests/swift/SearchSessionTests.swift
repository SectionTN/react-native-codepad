import XCTest

@testable import Codepad

final class SearchSessionTests: XCTestCase {
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
