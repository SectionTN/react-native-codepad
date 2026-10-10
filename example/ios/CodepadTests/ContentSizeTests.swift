import XCTest

@testable import Codepad

@MainActor
final class ContentSizeTests: XCTestCase {
  // A relayout would reset every row count to one; measured rows above the viewport must survive a height change.
  func testHeightOnlyResizeKeepsTheMeasuredRows() {
    let editor = launch()
    editor.setSoftWrap(true)
    editor.setInitialText((0..<100).map { _ in String(repeating: "word ", count: 60) }.joined(separator: "\n"))
    layout(editor)
    draw(editor)
    editor.scrollToLine(50, animated: false)
    draw(editor)
    let before = editor.latestFrame.contentHeight
    XCTAssertGreaterThan(before, 100 * 16 * 1.4, "rows measured beyond one per line, height \(before)")
    layout(editor, width: 300, height: 500)
    draw(editor)
    let after = editor.latestFrame.contentHeight
    XCTAssertGreaterThanOrEqual(after, before, "measured rows kept after a taller view, before \(before) after \(after)")
  }

  func testListenerReportsTheSizeWithInsetsOncePerChange() {
    let editor = launch()
    var sizes: [CGSize] = []
    editor.onContentSizeChange = { sizes.append($0) }
    editor.setContentInsets(top: 0, bottom: 24, left: 0, right: 0)
    editor.setInitialText("")
    layout(editor)
    draw(editor)
    XCTAssertEqual(sizes.count, 1)
    XCTAssertEqual(sizes[0].width, 300, accuracy: 0.5)
    // One row of a 16 pt font at 1.4 plus the bottom inset; the row height rounds to a whole point.
    let row = sizes[0].height - 24
    XCTAssertTrue(row > 20 && row < 26, "one row plus the inset, got \(sizes[0].height)")
    draw(editor)
    XCTAssertEqual(sizes.count, 1, "a plain redraw reports nothing")
    editor.core.typeText("\n")
    draw(editor)
    XCTAssertEqual(sizes.count, 2)
    XCTAssertEqual(sizes[1].height, 2 * row + 24, accuracy: 0.5)
  }
}
