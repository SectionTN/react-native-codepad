import XCTest

@testable import Codepad

final class BracketMatcherTests: XCTestCase {
  func testScanStopsAtTheStepLimit() {
    let inside = String(repeating: "x", count: 100_000)
    XCTAssertNil(BracketMatcher.match(Document("(" + inside + ")"), caret: 0, skip: nil))
    let found = BracketMatcher.match(Document("(" + String(repeating: "x", count: 99_998) + ")"), caret: 0, skip: nil)
    XCTAssertEqual(found?.0, 0)
    XCTAssertEqual(found?.1, 99_999)
  }

  func testSkipIsAskedOnlyForBracketCharacters() {
    let doc = Document("a(b c)d")
    var asked: [Int] = []
    _ = BracketMatcher.match(doc, caret: 1) {
      asked.append($0)
      return false
    }
    XCTAssertFalse(asked.isEmpty)
    XCTAssertTrue(asked.allSatisfy { doc.unit(at: $0) == 0x28 || doc.unit(at: $0) == 0x29 })
  }
}
