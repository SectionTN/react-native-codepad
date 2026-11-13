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

  // A draw that lays out new lines evicts the oldest layouts. After a jump back to the old end of the cache, the
  // frame's own cached lines must not be evicted before the draw reaches them, or they stay blank.
  func testAJumpBackKeepsTheFramesCachedLines() {
    let editor = launch()
    editor.setInitialText((0..<3000).map { "line \($0)" }.joined(separator: "\n"))
    layout(editor)
    draw(editor)
    let rowHeight = CGFloat(editor.viewport.rowHeight)
    let span = editor.viewport.lastVisibleLine() - editor.viewport.firstVisibleLine()
    var top = 0
    while top < 3 * editor.cache.capacity {
      top += span
      editor.contentOffset.y = CGFloat(top) * rowHeight
      draw(editor)
    }
    var oldest = Int.max
    editor.cache.forEachEntry { line, _ in oldest = min(oldest, line) }
    editor.contentOffset.y = CGFloat(oldest - span / 2) * rowHeight
    draw(editor)
    var cached = Set<Int>()
    editor.cache.forEachEntry { line, _ in cached.insert(line) }
    let frame = editor.viewport.firstVisibleLine()...editor.viewport.lastVisibleLine()
    XCTAssertEqual(frame.filter { !cached.contains($0) }, [], "frame \(frame), oldest cached before the jump \(oldest)")
  }

  // A measure call that lowers the end of the content clamps the scroll and shows lines above the draw's frame. The
  // same draw lays them out, so none of them shows blank.
  func testAClampInTheMeasureCallLaysOutTheLinesItShows() {
    let editor = launch()
    editor.setInitialText((0..<100).map { "line \($0)" }.joined(separator: "\n"))
    layout(editor)
    draw(editor)
    // The core holds 30 rows for the last line, its layout will have one.
    editor.viewport.measured(99, 30)
    editor.contentOffset.y = CGFloat(editor.viewport.maxScrollY)
    editor.setNeedsLayout()
    editor.layoutIfNeeded()
    var cached = Set<Int>()
    editor.cache.forEachEntry { line, _ in cached.insert(line) }
    let frame = editor.viewport.firstVisibleLine()...editor.viewport.lastVisibleLine()
    XCTAssertEqual(frame.filter { !cached.contains($0) }, [], "frame \(frame)")
  }
}
