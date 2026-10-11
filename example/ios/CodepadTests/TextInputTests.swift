import UIKit
import XCTest

@testable import Codepad

/// Records the UITextInputDelegate calls the view makes around programmatic changes.
@MainActor
final class DelegateRecorder: NSObject, UITextInputDelegate {
  var calls: [String] = []
  func selectionWillChange(_ textInput: (any UITextInput)?) { calls.append("selectionWillChange") }
  func selectionDidChange(_ textInput: (any UITextInput)?) { calls.append("selectionDidChange") }
  func textWillChange(_ textInput: (any UITextInput)?) { calls.append("textWillChange") }
  func textDidChange(_ textInput: (any UITextInput)?) { calls.append("textDidChange") }
  @available(iOS 18.4, *)
  func conversationContext(_ context: UIConversationContext?, didChange textInput: (any UITextInput)?) {}
}

@MainActor
final class TextInputTests: XCTestCase {
  private func marked(_ editor: CodeEditorView) -> [Int]? {
    (editor.textInput.markedTextRange as? CPTextRange).map { [$0.startOffset, $0.endOffset] }
  }

  func testTypingThroughInsertTextTakesTheKeyboardPath() {
    let editor = launch()
    editor.setInitialText("")
    layout(editor)
    var origins: [ChangeOrigin] = []
    editor.onChange = { _, origin in origins.append(origin) }
    editor.textInput.insertText("(")
    XCTAssertEqual(editor.core.document.text(), "()")
    XCTAssertEqual(editor.core.selection, Selection(anchor: 1, head: 1))
    editor.textInput.deleteBackward()
    XCTAssertEqual(editor.core.document.text(), "")
    XCTAssertEqual(origins, [.input, .input])
    editor.textInput.insertText("ab c")
    editor.core.setSelection(anchor: 0, head: 4)
    editor.textInput.insertText("x")
    XCTAssertEqual(editor.core.document.text(), "x", "insertText replaces a selection")
    editor.textInput.insertText("\n")
    XCTAssertEqual(editor.core.document.text(), "x\n")
  }

  func testTextRangesMapToTheCoreSelection() {
    let editor = launch()
    editor.setInitialText("abcdef")
    layout(editor)
    editor.textInput.selectedTextRange = CPTextRange(start: 1, end: 4)
    XCTAssertEqual(editor.core.selection, Selection(anchor: 1, head: 4))
    editor.core.setSelection(anchor: 5, head: 2)
    let range = editor.textInput.selectedTextRange as? CPTextRange
    XCTAssertEqual(range?.startOffset, 2)
    XCTAssertEqual(range?.endOffset, 5)
    editor.setInitialText("hello wrold")
    layout(editor)
    editor.textInput.replace(CPTextRange(start: 6, end: 11), withText: "world")
    XCTAssertEqual(editor.core.document.text(), "hello world")
    XCTAssertEqual(editor.core.selection, Selection(anchor: 11, head: 11))
  }

  func testSetTextDuringCompositionTellsTheKeyboard() {
    let editor = launch()
    editor.setInitialText("x = ")
    layout(editor)
    let recorder = DelegateRecorder()
    editor.textInput.inputDelegate = recorder
    editor.core.setSelection(anchor: 4, head: 4)
    editor.textInput.setMarkedText("ka", selectedRange: NSRange(location: 2, length: 0))
    XCTAssertEqual(marked(editor), [4, 6])
    recorder.calls = []
    editor.setText("new", keepHistory: false)
    XCTAssertEqual(recorder.calls.filter { $0.hasPrefix("text") }, ["textWillChange", "textDidChange"])
    XCTAssertNil(editor.textInput.markedTextRange)
  }

  func testWidthChangeKeepsTheMarkedRange() {
    let editor = launch()
    editor.setLineNumbers(false)
    editor.setSoftWrap(true)
    editor.setInitialText(String(repeating: "a", count: 40))
    layout(editor)
    editor.core.setSelection(anchor: 40, head: 40)
    editor.textInput.setMarkedText("かな", selectedRange: NSRange(location: 2, length: 0))
    draw(editor)
    XCTAssertEqual(marked(editor), [40, 42])
    let before = editor.textInput.markedUnderline.frame
    XCTAssertGreaterThan(before.width, 0)
    layout(editor, width: 150, height: 200)
    draw(editor)
    XCTAssertEqual(marked(editor), [40, 42])
    let after = editor.textInput.markedUnderline.frame
    XCTAssertGreaterThan(after.minY, before.minY, "the underline followed the marked text to its new row")
    XCTAssertEqual(after.maxY.truncatingRemainder(dividingBy: 22), 0, accuracy: 0.5, "the underline sits at a row bottom")
    editor.textInput.unmarkText()
    draw(editor)
    XCTAssertTrue(editor.textInput.markedUnderline.isHidden, "the underline hides with the marked text")
  }
}
