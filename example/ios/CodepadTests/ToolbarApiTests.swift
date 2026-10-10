import UIKit
import XCTest

@testable import Codepad

@MainActor
final class ToolbarApiTests: XCTestCase {
  func testVerticalMovesKeepTheGoalXAndStopAtTheEdges() {
    let editor = launch()
    editor.setInitialText("abcdef\nab\nabcdef")
    layout(editor)
    draw(editor)
    editor.core.setSelection(anchor: 5, head: 5)
    editor.perform(.vertical(direction: 1, page: false, extend: false))
    XCTAssertEqual(editor.core.selection, Selection(anchor: 9, head: 9))
    editor.perform(.vertical(direction: 1, page: false, extend: false))
    XCTAssertEqual(editor.core.selection, Selection(anchor: 15, head: 15))
    editor.perform(.vertical(direction: 1, page: true, extend: false))
    XCTAssertEqual(editor.core.selection, Selection(anchor: 16, head: 16), "page down past the end clamps to the document end")
    editor.perform(.vertical(direction: -1, page: true, extend: true))
    XCTAssertEqual(editor.core.selection.anchor, 16, "page up extends from the document end")
    XCTAssertEqual(editor.core.document.lineAt(editor.core.selection.head), 0)
  }

  func testTypeTextTakesTheKeyboardPath() {
    let editor = launch()
    editor.setInitialText("")
    layout(editor)
    editor.typeText("(")
    XCTAssertEqual(editor.core.document.text(), "()")
    XCTAssertEqual(editor.core.selection, Selection(anchor: 1, head: 1))
    editor.typeText(")")
    XCTAssertEqual(editor.core.document.text(), "()")
    XCTAssertEqual(editor.core.selection, Selection(anchor: 2, head: 2))
    editor.typeText("{")
    editor.typeText("\n")
    XCTAssertEqual(editor.core.document.text(), "(){\n    \n}")
    editor.setText("", keepHistory: false)
    editor.typeText("ab")
    editor.core.undo()
    XCTAssertEqual(editor.core.document.text(), "", "two typed chars undo as one group")
    editor.typeText("[")
    editor.perform(.backspace)
    XCTAssertEqual(editor.core.document.text(), "", "backspace removes the empty pair")
    editor.perform(.backspace)
    editor.perform(.delete)
    XCTAssertEqual(editor.core.document.text(), "")
  }

  func testReadOnlyIgnoresEditsAndStillMoves() {
    let editor = launch()
    editor.setInitialText("ab")
    layout(editor)
    editor.setReadOnly(true)
    editor.typeText("x")
    editor.perform(.backspace)
    editor.perform(.delete)
    XCTAssertEqual(editor.core.document.text(), "ab")
    editor.perform(.move(unit: .char, forward: true, extend: true))
    XCTAssertEqual(editor.core.selection, Selection(anchor: 0, head: 1))
  }

  func testRunOnMainRunsWhileDetached() {
    final class Flag {
      var ran = false
    }
    let editor = launch()
    editor.removeFromSuperview()
    XCTAssertNil(editor.window)
    let flag = Flag()
    editor.runOnMain { flag.ran = true }
    spin(until: { flag.ran })
    XCTAssertTrue(flag.ran, "the block ran without a window")
  }
}
