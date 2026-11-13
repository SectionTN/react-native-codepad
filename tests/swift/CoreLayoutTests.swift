import CodepadCore
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

  // A draw retries the measure call with a grown buffer. The short call must leave the buffer alone, and the
  // retry must not apply the measurement twice.
  func testMeasureWritesNothingIntoAShortBuffer() {
    let core = EditorCore((0..<20).map { _ in "x" }.joined(separator: "\n"))
    let viewport = Viewport()
    viewport.attach(core)
    viewport.rowHeight = 10
    viewport.resize(width: 100, height: 50)
    viewport.scrollTo(0, 50)
    var pairs: [Int32] = [2, 3]
    var short = [Int32](repeating: -7, count: 4)
    let needed = cp_layout_measure(viewport.handle, &pairs, 1, -1, 5, 9, nil, &short, UInt32(short.count))
    XCTAssertEqual(needed, 11)
    XCTAssertEqual(short, [-7, -7, -7, -7])
    var out = [Int32](repeating: 0, count: Int(needed))
    cp_layout_measure(viewport.handle, &pairs, 1, -1, 5, 9, nil, &out, UInt32(out.count))
    XCTAssertEqual(viewport.scrollY, 70, "one shift of two rows for the line above")
    XCTAssertEqual(Array(out[0...5]), [0, 10, 20, 30, 40, 50])
    XCTAssertEqual(Array(out[6...10]), [1, 1, 1, 1, 1])
  }

  // A fling frame makes one scroll call and learns from it which edge it reached, for the edge glow.
  func testScrollToReportsEachAxisThatMoved() {
    let core = EditorCore((0..<20).map { _ in String(repeating: "x", count: 30) }.joined(separator: "\n"))
    let viewport = Viewport()
    viewport.attach(core)
    viewport.rowHeight = 10
    viewport.resize(width: 100, height: 50)
    viewport.widestLine = 300
    XCTAssertEqual(cp_layout_scroll_to(viewport.handle, 0, 0, nil), 0)
    XCTAssertEqual(cp_layout_scroll_to(viewport.handle, 40, 0, nil), 1)
    XCTAssertEqual(cp_layout_scroll_to(viewport.handle, 40, 30, nil), 2)
    XCTAssertEqual(cp_layout_scroll_to(viewport.handle, 0, 0, nil), 3)
  }

  // onGapLayout publishes every gap on each draw, the ones off screen too, so the measure call carries them all.
  func testMeasureWritesEveryGapAfterTheRows() {
    let core = EditorCore((0..<20).map { _ in "x" }.joined(separator: "\n"))
    XCTAssertTrue(core.setDecorations([.gap(line: 1, rows: 2), .gap(line: 15, rows: 1)], revision: -1))
    let viewport = Viewport()
    viewport.attach(core)
    viewport.rowHeight = 10
    viewport.resize(width: 100, height: 50)
    viewport.scrollTo(0, 50)
    var none: [Int32] = []
    var out = [Int32](repeating: 0, count: 32)
    let needed = cp_layout_measure(viewport.handle, &none, 0, -1, 5, 6, nil, &out, UInt32(out.count))
    XCTAssertEqual(needed, 2 * 2 + 1 + 2 * 3)
    XCTAssertEqual(Array(out[0...2]), [20, 30, 40])
    XCTAssertEqual(Array(out[3...4]), [1, 1])
    XCTAssertEqual(Array(out[5...10]), [1, -30, 2, 15, 130, 1])
  }

  // Between measure and endDraw the painters read the draw's copy. A copy that drifts from the core puts a line,
  // the gutter or a gap at the wrong height, and a read that still crosses into the core costs a call per line.
  func testDrawReadsMatchTheCoreWithoutCalls() {
    let core = EditorCore((0..<60).map { "line \($0)" }.joined(separator: "\n"))
    XCTAssertTrue(core.setDecorations([.gap(line: 2, rows: 2), .gap(line: 21, rows: 1), .gap(line: 50, rows: 3)], revision: -1))
    let viewport = Viewport()
    viewport.attach(core)
    viewport.rowHeight = 10
    viewport.resize(width: 100, height: 60)
    viewport.setInsets(top: 7, bottom: 5, left: 3, right: 0)
    viewport.gutterWidth = 20
    viewport.beginDraw(scrollX: 0, scrollY: 205)
    let first = viewport.firstVisibleLine()
    let last = first + 60 / 10 + 1
    let moved = viewport.measure(pairs: [Int32(first - 3), 2, Int32(first + 1), 3], widest: 400, first: first, last: last)
    XCTAssertTrue(moved, "a line above the view grew")
    func reads() -> [Int] {
      var out = [
        viewport.scrollX, viewport.scrollY, viewport.maxScrollY, viewport.contentWidth, viewport.contentHeight,
        viewport.textAreaLeft, viewport.textAreaWidth, viewport.wrapWidth, viewport.firstVisibleLine(),
        viewport.lastVisibleLine(), viewport.widestLine, Int(viewport.viewX(0)), viewport.rowTop(30),
      ]
      for line in first...(last + 1) { out += [viewport.lineTop(line), viewport.rowStart(line)] }
      for line in first...last { out.append(viewport.rows(line)) }
      for gap in viewport.gaps() { out += [gap.line, gap.top, gap.rows] }
      return out
    }
    let drawn = reads()
    XCTAssertEqual(viewport.drawCalls, 0)
    viewport.endDraw()
    XCTAssertEqual(drawn, reads())
    XCTAssertEqual(viewport.gaps().map(\.line), [2, 21, 50])
  }
}
