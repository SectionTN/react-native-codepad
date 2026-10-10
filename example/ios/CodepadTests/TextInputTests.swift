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
  }

  func testMarkedTextSequenceFromTheKanaFixture() throws {
    // Four levels up from example/ios/CodepadTests is the repo root; the simulator reads the Mac's files.
    let url = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
      .appendingPathComponent("tests/ime-ios/kana.json")
    let root = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    let sessions = try XCTUnwrap(root["sessions"] as? [[String: Any]])
    let editor = launch()
    editor.setLineNumbers(false)
    for (i, session) in sessions.enumerated() {
      let initial = try XCTUnwrap(session["initial"] as? [String: Any])
      let sel = try XCTUnwrap(initial["selection"] as? [Int])
      editor.setInitialText(try XCTUnwrap(initial["text"] as? String))
      layout(editor)
      editor.core.setSelection(anchor: sel[0], head: sel[1])
      for (j, step) in (session["steps"] as? [[String: Any]] ?? []).enumerated() {
        let call = step["call"] as? String ?? ""
        let args = step["args"] as? [Any] ?? []
        let at = "session \(i + 1) step \(j + 1) (\(call))"
        switch call {
        case "setMarkedText":
          let r = args.count > 1 ? args[1] as? [Int] ?? [0, 0] : [0, 0]
          editor.textInput.setMarkedText(args.first as? String, selectedRange: NSRange(location: r[0], length: r[1]))
        case "unmarkText":
          editor.textInput.unmarkText()
        default:
          XCTFail("\(at): unknown call")
        }
        let after = try XCTUnwrap(step["after"] as? [String: Any])
        if let v = after["sel"] as? [Int] { XCTAssertEqual(editor.core.selection, Selection(anchor: v[0], head: v[1]), "\(at) selection") }
        XCTAssertEqual(marked(editor), after["marked"] as? [Int], "\(at) marked")
        if let v = after["text"] as? String { XCTAssertEqual(editor.core.document.text(), v, "\(at) text") }
        draw(editor)
        let underline = editor.textInput.markedUnderline
        if marked(editor) != nil {
          XCTAssertFalse(underline.isHidden, "\(at) underline shown")
          XCTAssertGreaterThan(underline.frame.width, 0, "\(at) underline width")
          XCTAssertEqual(underline.frame.maxY, 22, accuracy: 0.5, "\(at) underline at the row bottom")
        } else {
          XCTAssertTrue(underline.isHidden, "\(at) underline hidden")
        }
      }
    }
  }

  func testReplaceRewritesAWord() {
    let editor = launch()
    editor.setInitialText("hello wrold")
    layout(editor)
    editor.textInput.replace(CPTextRange(start: 6, end: 11), withText: "world")
    XCTAssertEqual(editor.core.document.text(), "hello world")
    XCTAssertEqual(editor.core.selection, Selection(anchor: 11, head: 11))
  }

  func testSelectedTextRangeAssignmentMovesTheCoreSelection() {
    let editor = launch()
    editor.setInitialText("abcdef")
    layout(editor)
    editor.textInput.selectedTextRange = CPTextRange(start: 1, end: 4)
    XCTAssertEqual(editor.core.selection, Selection(anchor: 1, head: 4))
    editor.core.setSelection(anchor: 5, head: 2)
    let range = editor.textInput.selectedTextRange as? CPTextRange
    XCTAssertEqual(range?.startOffset, 2)
    XCTAssertEqual(range?.endOffset, 5)
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
  }
}
