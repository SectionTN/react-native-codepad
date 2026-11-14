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
    // Line 0 holds the caret, which every draw lays out, so it stays the newest entry.
    var oldest = Int.max
    editor.cache.forEachEntry { line, _ in if line > 0 { oldest = min(oldest, line) } }
    editor.contentOffset.y = CGFloat(oldest - span / 2) * rowHeight
    // One layout pass: a render can run a second one, which lays the evicted lines out and hides the miss.
    editor.setNeedsLayout()
    editor.layoutIfNeeded()
    var cached = Set<Int>()
    editor.cache.forEachEntry { line, _ in cached.insert(line) }
    let frame = editor.viewport.firstVisibleLine()...editor.viewport.lastVisibleLine()
    XCTAssertEqual(frame.filter { !cached.contains($0) }, [], "frame \(frame), oldest cached before the jump \(oldest)")
  }

  // A measure call that lowers the end of the content clamps the scroll and shows lines above the draw's frame, and
  // their measure call can clamp again. The same draw lays them all out, so none of them shows blank.
  func testAClampInTheMeasureCallLaysOutTheLinesItShows() {
    let editor = launch()
    editor.setInitialText((0..<100).map { "line \($0)" }.joined(separator: "\n"))
    layout(editor)
    draw(editor)
    // The core holds 30 rows for each of the last two lines, their layouts will have one.
    editor.viewport.measured(98, 30)
    editor.viewport.measured(99, 30)
    editor.contentOffset.y = CGFloat(editor.viewport.maxScrollY)
    editor.setNeedsLayout()
    editor.layoutIfNeeded()
    var cached = Set<Int>()
    editor.cache.forEachEntry { line, _ in cached.insert(line) }
    let frame = editor.viewport.firstVisibleLine()...editor.viewport.lastVisibleLine()
    XCTAssertEqual(frame.filter { !cached.contains($0) }, [], "frame \(frame)")
  }

  // A measure call that clamps the scroll moves it in a draw where nothing else scrolled. The listener hears of it.
  func testAClampInTheMeasureCallReachesTheScrollListener() {
    let editor = launch()
    editor.setInitialText((0..<100).map { "line \($0)" }.joined(separator: "\n"))
    layout(editor)
    draw(editor)
    editor.viewport.measured(98, 30)
    editor.viewport.measured(99, 30)
    _ = editor.viewport.scrollTo(0, editor.viewport.maxScrollY)
    editor.contentOffset.y = CGFloat(editor.viewport.scrollY)
    let before = editor.viewport.scrollY
    var heard: CGFloat?
    editor.onScroll = { heard = $0.scrollY }
    editor.setNeedsLayout()
    editor.layoutIfNeeded()
    XCTAssertLessThan(editor.viewport.scrollY, before, "the measure call clamped the scroll")
    XCTAssertEqual(heard, CGFloat(editor.viewport.scrollY))
  }

  // An API edit that removes the lines under the offset clamps the core scroll. The scroll view and the scroll
  // listener must take it, or the layers paint at one offset while UIKit and the host keep another.
  func testAnEditThatShortensTheContentUnderTheOffsetMovesIt() {
    let editor = launch()
    editor.setInitialText((0..<200).map { "line \($0)" }.joined(separator: "\n"))
    layout(editor)
    draw(editor)
    var heard: CGFloat?
    editor.onScroll = { heard = $0.scrollY }
    // Keeping 110 lines keeps the gutter, keeping 20 shrinks it and relays out. Both clamp the scroll.
    for keep in [110, 20] {
      editor.contentOffset.y = CGFloat(editor.viewport.maxScrollY)
      draw(editor)
      heard = nil
      _ = editor.core.replace(editor.core.document.lineStart(keep), editor.core.document.length, "")
      draw(editor)
      XCTAssertEqual(editor.contentOffset.y, CGFloat(editor.viewport.scrollY), "keeping \(keep) lines")
      XCTAssertLessThanOrEqual(editor.viewport.scrollY, editor.viewport.maxScrollY)
      XCTAssertEqual(heard, CGFloat(editor.viewport.scrollY), "keeping \(keep) lines")
    }
  }

  // The lines an animated scroll passes get their wrapped heights on the way, which moves the target line down.
  // The scroll still ends with that line at the top.
  func testAnAnimatedScrollToLineWithWrapEndsAtTheLine() {
    let editor = launch()
    editor.setSoftWrap(true)
    editor.setInitialText((0..<600).map { "line \($0) " + String(repeating: "word ", count: 20) }.joined(separator: "\n"))
    layout(editor)
    draw(editor)
    editor.scrollToLine(400, animated: true)
    XCTAssertLessThan(editor.contentOffset.y, CGFloat(editor.viewport.rowHeight), "the scroll is animating")
    // The rows the passed lines would get from the draws on the way.
    for line in 1..<400 { editor.viewport.measured(line, 3) }
    spin(until: { false }, timeout: 1)
    draw(editor)
    XCTAssertEqual(editor.viewport.firstVisibleLine(), 400)
    XCTAssertEqual(editor.viewport.scrollY, editor.viewport.rowStart(400) * editor.viewport.rowHeight)
  }

  // A scroll UIKit animates (a deceleration, an animated offset) stops when scrollToLine starts.
  func testAScrollToLineTakesOverAScrollInFlight() {
    for animated in [false, true] {
      let editor = launch()
      editor.setInitialText((0..<600).map { "line \($0)" }.joined(separator: "\n"))
      layout(editor)
      draw(editor)
      editor.setContentOffset(CGPoint(x: 0, y: 400 * editor.viewport.rowHeight), animated: true)
      editor.scrollToLine(50, animated: animated)
      spin(until: { false }, timeout: 1)
      draw(editor)
      XCTAssertEqual(editor.viewport.firstVisibleLine(), 50, "animated \(animated)")
    }
  }

  // A document replaced during an animated scrollToLine stays at the top.
  func testReplacingTheDocumentStopsAnAnimatedScrollToLine() {
    let long = (0..<600).map { "line \($0)" }.joined(separator: "\n")
    let replacements: [(String, (CodeEditorView) -> Void)] = [
      ("setText", { $0.setText(long, keepHistory: false) }),
      ("setInitialText", { $0.setInitialText(long) }),
    ]
    for (name, replace) in replacements {
      let editor = launch()
      editor.setInitialText(long)
      layout(editor)
      draw(editor)
      editor.scrollToLine(400, animated: true)
      spin(until: { editor.contentOffset.y > 0 }, timeout: 1)
      let target = CGFloat(editor.viewport.rowStart(400) * editor.viewport.rowHeight)
      XCTAssertTrue(editor.contentOffset.y > 0 && editor.contentOffset.y < target, "\(name): the scroll is animating")
      replace(editor)
      spin(until: { false }, timeout: 1)
      draw(editor)
      XCTAssertEqual(editor.viewport.scrollY, 0, name)
    }
  }
}
