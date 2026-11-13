import XCTest

@testable import Codepad

// The layout math runs on the shared vectors. Only the iOS gesture rule stays here.
final class ViewportTests: XCTestCase {
  func testPansSidewaysOnlyForAMostlyHorizontalDragOverWideText() {
    let v = Viewport()
    v.rowHeight = 20
    v.resize(width: 400, height: 200)
    v.widestLine = 1000
    XCTAssertTrue(v.pansSideways(dx: 30, dy: 12))
    XCTAssertTrue(v.pansSideways(dx: -30, dy: 12))
    XCTAssertFalse(v.pansSideways(dx: 12, dy: 30))
    XCTAssertFalse(v.pansSideways(dx: 20, dy: -20))
    v.widestLine = 100
    XCTAssertFalse(v.pansSideways(dx: 30, dy: 0))
  }
}
