import UIKit
import XCTest

@testable import Codepad

@MainActor
final class FocusTests: XCTestCase {
  func testBecomeFirstResponderEmitsFocusAndActivatesTheInteraction() {
    let editor = launch()
    editor.setInitialText("abc")
    layout(editor)
    var focus = 0
    var blur = 0
    editor.onEditorFocus = { focus += 1 }
    editor.onEditorBlur = { blur += 1 }
    editor.focus()
    XCTAssertEqual(focus, 1)
    XCTAssertTrue(editor.hasFocus)
    XCTAssertTrue(editor.textInput.selectionInteraction.isActivated)
    editor.blur()
    XCTAssertEqual(blur, 1)
    XCTAssertFalse(editor.hasFocus)
    XCTAssertFalse(editor.textInput.selectionInteraction.isActivated)
  }

  func testReadOnlyShowsNoKeyboardAndStillSelects() {
    let editor = launch()
    editor.setInitialText("hello")
    layout(editor)
    editor.setReadOnly(true)
    let input = editor.textInput
    XCTAssertNotNil(input.inputView)
    XCTAssertEqual(input.inputView?.bounds.size, .zero)
    editor.focus()
    input.selectedTextRange = CPTextRange(start: 1, end: 3)
    XCTAssertEqual(editor.core.selection, Selection(anchor: 1, head: 3))
    draw(editor)
    XCTAssertTrue(input.cursorView.isHidden)
  }

  func testAutoFocusFiresOnceInTheWindow() {
    let editor = launch()
    editor.setInitialText("abc")
    var focus = 0
    editor.onEditorFocus = { focus += 1 }
    editor.setAutoFocus(true)
    layout(editor)
    draw(editor)
    draw(editor)
    XCTAssertEqual(focus, 1)
    XCTAssertTrue(editor.hasFocus)
  }

  func testTraitsFollowSuggestions() {
    let editor = launch()
    let input = editor.textInput
    XCTAssertEqual(input.autocorrectionType, .no)
    XCTAssertEqual(input.smartQuotesType, .no)
    XCTAssertEqual(input.inlinePredictionType, .no)
    editor.setSuggestions(.on)
    XCTAssertEqual(input.autocorrectionType, .yes)
    XCTAssertEqual(input.inlinePredictionType, .yes)
    XCTAssertEqual(input.smartQuotesType, .no)
    editor.setSuggestions(.forceOff)
    XCTAssertEqual(input.autocorrectionType, .no)
    XCTAssertEqual(input.smartQuotesType, .no)
    editor.setSuggestions(.off)
    XCTAssertEqual(input.autocorrectionType, .no)
    XCTAssertEqual(input.smartDashesType, .no)
  }
}
