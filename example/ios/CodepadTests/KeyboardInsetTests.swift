import UIKit
import XCTest

@testable import Codepad

@MainActor
final class KeyboardInsetTests: XCTestCase {
  func testTrackerFollowsThePropAndTheAttachment() {
    let editor = launch()
    guard let window = editor.window else { return XCTFail("no window") }
    XCTAssertNil(editor.keyboardTracker)
    editor.setAvoidKeyboard(true)
    XCTAssertNotNil(editor.keyboardTracker)
    editor.removeFromSuperview()
    XCTAssertNil(editor.keyboardTracker)
    window.addSubview(editor)
    XCTAssertNotNil(editor.keyboardTracker)
    editor.setAvoidKeyboard(false)
    XCTAssertNil(editor.keyboardTracker)
  }

  // The window's own keyboard layout guide can hold a zero frame, which read as a keyboard over the whole view and
  // pinned every caret reveal to the top row.
  func testAStartedTrackerReadsNoOverlapWithoutAKeyboard() {
    let editor = launch(height: 300)
    editor.setAvoidKeyboard(true)
    XCTAssertEqual(editor.keyboardInset, 0)
  }

  func testKeyboardInsetExtendsTheScrollRangeAndLeavesTheContentSizeAlone() {
    let editor = launch(height: 400)
    var sizes: [CGSize] = []
    editor.onContentSizeChange = { sizes.append($0) }
    let text = (0..<50).map { "line \($0)" }.joined(separator: "\n")
    editor.setInitialText(text)
    editor.core.setSelection(anchor: text.utf16.count, head: text.utf16.count)
    layout(editor, height: 400)
    editor.focus()
    draw(editor)
    editor.scrollToLine(49, animated: false)
    draw(editor)
    let before = editor.contentOffset.y
    XCTAssertEqual(before, editor.contentSize.height - 400, accuracy: 0.5, "scrolled to the end")
    // The inset extends the range by its height and the reveal moves the caret row above the keyboard.
    editor.applyKeyboardInset(300)
    draw(editor)
    XCTAssertEqual(editor.contentOffset.y - before, 300, accuracy: 1)
    XCTAssertEqual(sizes.count, 1, "content size excludes the keyboard inset")
    editor.applyKeyboardInset(0)
    draw(editor)
    XCTAssertEqual(editor.contentOffset.y, before, accuracy: 1, "the scroll clamps back to the end")
    XCTAssertEqual(sizes.count, 1)
  }

  func testOverlapIsMeasuredInTheEditorsCoordinates() {
    let editor = launch(height: 300)
    editor.frame = CGRect(x: 0, y: 0, width: 300, height: 200)
    let tracker = KeyboardInsetTracker(view: editor) { _ in }
    // A 300 pt keyboard over a 300 pt window: the editor ends 100 pt above the window bottom, so 200 pt overlap.
    XCTAssertEqual(tracker.overlap(forKeyboardFrame: CGRect(x: 0, y: 0, width: 300, height: 300)), 200)
    XCTAssertEqual(tracker.overlap(forKeyboardFrame: CGRect(x: 0, y: 300, width: 300, height: 300)), 0)
  }
}
