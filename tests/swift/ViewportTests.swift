import XCTest

@testable import Codepad

final class ViewportTests: XCTestCase {
  private func viewport(lines: Int = 100, rowHeight: Int = 20, height: Int = 200, width: Int = 400) -> Viewport {
    let v = Viewport(heights: HeightMap(lineCount: lines))
    v.rowHeight = rowHeight
    v.height = height
    v.width = width
    return v
  }

  func testClampsScrollToTheContent() {
    let v = viewport()
    XCTAssertEqual(v.contentHeight, 2000)
    XCTAssertEqual(v.maxScrollY, 1800)
    XCTAssertTrue(v.scrollTo(0, 5000))
    XCTAssertEqual(v.scrollY, 1800)
    XCTAssertFalse(v.scrollTo(-10, 1800))
    XCTAssertEqual(v.scrollX, 0)
    XCTAssertEqual(v.maxScrollX, 0)
    XCTAssertTrue(v.scrollTo(0, 800))
    XCTAssertEqual(v.scrollY, 800)
    v.scrollTo(0, 5000)
    v.height = 300
    XCTAssertTrue(v.clamp())
    XCTAssertEqual(v.scrollY, 1700)
  }

  func testMapsRowsToViewPointsThroughInsets() {
    let v = viewport()
    v.insetTop = 30
    v.insetBottom = 50
    XCTAssertEqual(v.viewportHeight, 120)
    XCTAssertEqual(v.maxScrollY, 1880)
    XCTAssertEqual(v.lineTop(0), 30)
    XCTAssertEqual(v.rowAt(0), -2)
    _ = v.scrollTo(0, 45)
    XCTAssertEqual(v.firstVisibleLine(), 2)
    XCTAssertEqual(v.lineTop(2), 25)
    XCTAssertEqual(v.lastVisibleLine(), 8)
    XCTAssertEqual(v.rowAt(55), 3)
    XCTAssertEqual(v.rowAt(0), 0)
  }

  func testHorizontalRangeFollowsTheWidestLine() {
    let v = viewport()
    v.gutterWidth = 40
    v.textPadding = 8
    v.widestLine = 1000
    XCTAssertEqual(v.textAreaLeft, 40)
    XCTAssertEqual(v.textAreaWidth, 360)
    XCTAssertEqual(v.contentWidth, 1016)
    XCTAssertEqual(v.maxScrollX, 656)
    XCTAssertEqual(v.wrapWidth, 0)
    XCTAssertEqual(v.contentX(148), 100)
    _ = v.scrollTo(100, 0)
    XCTAssertEqual(v.viewX(0), -52)
    v.wrap = true
    XCTAssertEqual(v.maxScrollX, 0)
    XCTAssertEqual(v.wrapWidth, 344)
    XCTAssertEqual(v.contentWidth, 360)
  }

  func testRevealScrollsTheMinimumDistance() {
    let v = viewport()
    v.textPadding = 8
    v.widestLine = 1000
    XCTAssertTrue(v.reveal(left: 0, top: 500, right: 10, bottom: 520))
    XCTAssertEqual(v.scrollY, 320)
    XCTAssertTrue(v.reveal(left: 0, top: 100, right: 10, bottom: 120))
    XCTAssertEqual(v.scrollY, 100)
    XCTAssertFalse(v.reveal(left: 0, top: 150, right: 10, bottom: 170))
    XCTAssertTrue(v.reveal(left: 490, top: 150, right: 500, bottom: 170))
    XCTAssertEqual(v.scrollX, 116)
    XCTAssertTrue(v.reveal(left: 0, top: 0, right: 10, bottom: 20))
    XCTAssertEqual(v.scrollX, 0)
    XCTAssertEqual(v.scrollY, 0)
  }

  func testAnchorSurvivesARelayout() {
    let v = viewport()
    v.heights.setRows(3, 4)
    _ = v.scrollTo(0, 80)
    let a = v.anchor()
    XCTAssertEqual(a.line, 3)
    XCTAssertEqual(a.offset, 20)
    v.heights.resetAll()
    v.restore(a)
    XCTAssertEqual(v.scrollY, 60)
    v.heights.setRows(3, 4)
    v.restore(a)
    XCTAssertEqual(v.scrollY, 80)
  }

  func testMeasuringALineAboveKeepsTheViewportStill() {
    let v = viewport()
    _ = v.scrollTo(0, 400)
    XCTAssertEqual(v.firstVisibleLine(), 20)
    v.measured(5, 3)
    XCTAssertEqual(v.scrollY, 440)
    XCTAssertEqual(v.firstVisibleLine(), 20)
    v.measured(20, 2)
    XCTAssertEqual(v.scrollY, 440)
    v.measured(5, 3)
    XCTAssertEqual(v.scrollY, 440)
  }

  func testResizeAndInsetsReportOnlyTextAreaWidthChanges() {
    let v = viewport()
    XCTAssertFalse(v.resize(width: 400, height: 300))
    XCTAssertEqual(v.height, 300)
    XCTAssertTrue(v.resize(width: 500, height: 300))
    XCTAssertEqual(v.width, 500)
    XCTAssertFalse(v.setInsets(top: 10, bottom: 20, left: 0, right: 0))
    XCTAssertEqual(v.insetBottom, 20)
    XCTAssertTrue(v.setInsets(top: 10, bottom: 20, left: 8, right: 0))
    XCTAssertEqual(v.insetLeft, 8)
    XCTAssertTrue(v.setInsets(top: 10, bottom: 20, left: 8, right: 4))
    XCTAssertFalse(v.setInsets(top: 0, bottom: 0, left: 8, right: 4))
  }
}
