import XCTest

@testable import Codepad

final class SearcherTests: XCTestCase {
  func testCancellationStopsTheScan() {
    var reads = 0
    XCTAssertThrowsError(
      try Searcher.find("ab ab ab ab", SearchQuery(text: "ab")) {
        reads += 1
        return reads > 3
      }
    ) { error in
      XCTAssertTrue(error is CancellationError, "\(error)")
    }
  }
}
