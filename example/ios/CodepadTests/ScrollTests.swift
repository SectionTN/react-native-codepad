import XCTest

@testable import Codepad

@MainActor
final class ScrollTests: XCTestCase {
  func testInsetChangesKeepTheHorizontalScroll() {
    let editor = launch()
    editor.setLineNumbers(false)
    editor.setInitialText(String(repeating: "x", count: 200))
    layout(editor)
    draw(editor)
    editor.core.move(.lineEnd, forward: true, extend: false)
    editor.revealSelection()
    draw(editor)
    let before = editor.latestFrame.scrollX
    XCTAssertGreaterThan(before, 0, "the caret reveal scrolled right, scrollX \(before)")
    editor.setContentInsets(top: 0, bottom: 24, left: 0, right: 0)
    draw(editor)
    XCTAssertEqual(editor.latestFrame.scrollX, before, accuracy: 0.5, "scrollX after the inset change")
  }
}
