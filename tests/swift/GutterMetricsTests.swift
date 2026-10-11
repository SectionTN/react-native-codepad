import XCTest

@testable import Codepad

final class GutterMetricsTests: XCTestCase {
  func testGutterWidthCountsDigits() {
    XCTAssertEqual(GutterMetrics.digits(0), 1)
    XCTAssertEqual(GutterMetrics.digits(9), 1)
    XCTAssertEqual(GutterMetrics.digits(10), 2)
    XCTAssertEqual(GutterMetrics.digits(1000), 4)
    XCTAssertEqual(GutterMetrics.width(lineCount: 42, digitAdvance: 7, padding: 8), 30)
  }
}
