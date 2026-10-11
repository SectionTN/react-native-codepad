import XCTest

@testable import Codepad

final class SpansTests: XCTestCase {
  // A burst of cancelled edits used to add one region per key, and the next pass ran one query per key.
  func testOverlappingAndTouchingPairsMergeAndDisjointOnesStaySorted() {
    XCTAssertEqual(coalesce([8, 9, 4, 6, 0, 2, 2, 5]), [0, 6, 8, 9])
  }

  // A deletion's span is zero width; dropping it would leave the deleted tree unreached by the pass.
  func testZeroWidthPairsSurviveAndMergeWhenTouched() {
    XCTAssertEqual(coalesce([3, 3]), [3, 3])
    XCTAssertEqual(coalesce([5, 7, 3, 3, 7, 7]), [3, 3, 5, 7])
  }
}
