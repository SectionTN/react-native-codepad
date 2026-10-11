import Foundation
import XCTest

@testable import Codepad

final class GestureMachineTests: XCTestCase {
  private final class RecordingHost: GestureHost {
    var calls: [String] = []
    var selected: ClosedRange<Int>? = nil
    var caret = false

    func offsetAt(x: CGFloat, y: CGFloat) -> Int { Int(x) }
    func insideSelection(_ offset: Int) -> Bool { selected?.contains(offset) ?? false }
    func caretHit(x: CGFloat, y: CGFloat) -> Bool { caret }
    func placeCaret(_ offset: Int) { calls.append("caret \(offset)") }
    func selectWord(_ offset: Int) { calls.append("word \(offset)") }
    func selectLine(_ offset: Int) { calls.append("line \(offset)") }
    func beginLoupe(x: CGFloat, y: CGFloat) { calls.append("loupe begin \(Int(x))") }
    func moveLoupe(x: CGFloat, y: CGFloat) { calls.append("loupe move \(Int(x))") }
    func endLoupe() { calls.append("loupe end") }
    func showMenu() { calls.append("menu") }
    func yieldToScroll() { calls.append("yield") }
    func postLongPress(delay: TimeInterval) { calls.append("timer \(delay)") }
    func cancelLongPress() { calls.append("cancel") }
  }

  private let config = GestureMachine.Config(touchSlop: 8, doubleTapSlop: 40, doubleTapTimeout: 0.3, longPressTimeout: 0.4)

  private func tap(_ m: GestureMachine, _ x: CGFloat, _ y: CGFloat, at time: TimeInterval) {
    m.down(x: x, y: y, time: time)
    m.up(x: x, y: y, time: time + 0.05)
  }

  func testTapPlacesTheCaret() {
    let h = RecordingHost()
    let m = GestureMachine(host: h, config: config)
    m.down(x: 100, y: 10, time: 0)
    m.move(x: 103, y: 12, time: 0.02)
    m.up(x: 103, y: 12, time: 0.05)
    XCTAssertEqual(h.calls, ["timer 0.4", "cancel", "caret 103"])
  }

  func testSecondTapInsideTheWindowSelectsTheWord() {
    let h = RecordingHost()
    let m = GestureMachine(host: h, config: config)
    tap(m, 100, 10, at: 0)
    XCTAssertEqual(h.calls.last, "caret 100")
    tap(m, 105, 12, at: 0.2)
    XCTAssertEqual(h.calls.last, "word 105")
    tap(m, 105, 12, at: 1.0)
    XCTAssertEqual(h.calls.last, "caret 105")
    tap(m, 180, 12, at: 1.1)
    XCTAssertEqual(h.calls.last, "caret 180")
  }

  func testTripleTapSelectsTheLine() {
    let h = RecordingHost()
    let m = GestureMachine(host: h, config: config)
    tap(m, 100, 10, at: 0)
    tap(m, 102, 10, at: 0.2)
    tap(m, 104, 10, at: 0.4)
    XCTAssertEqual(h.calls.last, "line 104")
    tap(m, 104, 10, at: 0.6)
    XCTAssertEqual(h.calls.last, "caret 104")
  }

  func testTapOnTheCaretOrInsideTheSelectionOpensTheMenu() {
    let h = RecordingHost()
    h.caret = true
    let m = GestureMachine(host: h, config: config)
    tap(m, 100, 10, at: 0)
    XCTAssertEqual(h.calls, ["timer 0.4", "cancel", "menu"])
    let selected = RecordingHost()
    selected.selected = 90...120
    tap(GestureMachine(host: selected, config: config), 100, 10, at: 0)
    XCTAssertEqual(selected.calls, ["timer 0.4", "cancel", "menu"])
  }

  func testDragLeavesTheGestureToTheScrollView() {
    let h = RecordingHost()
    let m = GestureMachine(host: h, config: config)
    m.down(x: 100, y: 100, time: 0)
    m.move(x: 100, y: 95, time: 0.01)
    XCTAssertFalse(h.calls.contains("yield"))
    m.move(x: 100, y: 80, time: 0.02)
    m.move(x: 100, y: 60, time: 0.03)
    m.up(x: 100, y: 60, time: 0.04)
    XCTAssertEqual(h.calls, ["timer 0.4", "cancel", "yield", "cancel"])
  }

  func testLongPressBeginsTheLoupeAndTheCaretFollowsTheFinger() {
    let h = RecordingHost()
    let m = GestureMachine(host: h, config: config)
    m.down(x: 100, y: 10, time: 0)
    m.longPress()
    XCTAssertEqual(h.calls, ["timer 0.4", "caret 100", "loupe begin 100"])
    m.move(x: 104, y: 10, time: 0.5)
    m.move(x: 130, y: 10, time: 0.52)
    m.up(x: 130, y: 10, time: 0.6)
    XCTAssertEqual(
      Array(h.calls.dropFirst(3)), ["caret 104", "loupe move 104", "caret 130", "loupe move 130", "cancel", "loupe end", "menu"])
  }

  func testCancelEndsALoupe() {
    let h = RecordingHost()
    let m = GestureMachine(host: h, config: config)
    m.down(x: 100, y: 10, time: 0)
    m.longPress()
    m.cancel()
    XCTAssertEqual(Array(h.calls.suffix(2)), ["cancel", "loupe end"])
    tap(m, 100, 10, at: 1.0)
    XCTAssertEqual(h.calls.last, "caret 100")
  }
}
