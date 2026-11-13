import XCTest

@testable import Codepad

@MainActor
final class CoreLayoutTests: XCTestCase {
  // The view repaints from the change callback, so the rows must already follow the edit when it runs.
  func testRowsFollowAnEditBeforeTheChangeCallback() {
    let core = EditorCore("a")
    let viewport = Viewport()
    viewport.attach(core)
    var seen = -1
    core.onChange = { _, _ in seen = viewport.totalRows }
    core.replace(1, 1, "\nb\nc")
    XCTAssertEqual(seen, 3)
  }

  // setInitialText swaps the editor under the same view: its size and metrics stay, its rows start over.
  func testAReattachedLayoutKeepsItsMetrics() {
    let first = EditorCore("a\nb\nc")
    let viewport = Viewport()
    viewport.attach(first)
    viewport.rowHeight = 10
    _ = viewport.resize(width: 100, height: 50)
    viewport.measured(1, 3)
    XCTAssertEqual(viewport.totalRows, 5)
    let second = EditorCore("a\nb\nc\nd\ne")
    viewport.attach(second)
    XCTAssertEqual(viewport.width, 100)
    XCTAssertEqual(viewport.rowHeight, 10)
    XCTAssertEqual(viewport.rows(1), 1)
    XCTAssertEqual(viewport.totalRows, 5)
    first.replace(0, 0, "x\n")
    XCTAssertEqual(viewport.lineCount, 5, "the old editor no longer reaches the layout")
  }
}
