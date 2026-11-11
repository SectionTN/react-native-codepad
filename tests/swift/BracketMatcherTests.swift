import XCTest

@testable import Codepad

final class BracketMatcherTests: XCTestCase {
  func testScanStopsAtTheStepLimit() {
    let inside = String(repeating: "x", count: 100_000)
    XCTAssertNil(BracketMatcher.match(Document("(" + inside + ")"), caret: 0, snapshot: nil))
    let found = BracketMatcher.match(Document("(" + String(repeating: "x", count: 99_998) + ")"), caret: 0, snapshot: nil)
    XCTAssertEqual(found?.0, 0)
    XCTAssertEqual(found?.1, 99_999)
  }
}
