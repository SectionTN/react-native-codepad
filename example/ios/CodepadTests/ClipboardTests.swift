import UIKit
import XCTest

@testable import Codepad

@MainActor
final class ClipboardTests: XCTestCase {
  func testCopyPutsTheSelectionOnThePasteboard() {
    let editor = launch()
    editor.setInitialText("hello world")
    layout(editor)
    UIPasteboard.general.items = []
    editor.core.setSelection(anchor: 6, head: 11)
    XCTAssertTrue(editor.copySelection())
    XCTAssertEqual(UIPasteboard.general.string, "world")
    editor.core.setSelection(anchor: 2, head: 2)
    XCTAssertFalse(editor.copySelection(), "nothing to copy without a selection")
    XCTAssertEqual(UIPasteboard.general.string, "world")
  }

  func testPasteInsertsWithInputOrigin() {
    let editor = launch()
    editor.setInitialText("hello world")
    layout(editor)
    var origins: [ChangeOrigin] = []
    editor.onChange = { _, origin in origins.append(origin) }
    UIPasteboard.general.string = "big "
    editor.core.setSelection(anchor: 6, head: 6)
    editor.textInput.paste(nil)
    XCTAssertEqual(editor.core.document.text(), "hello big world")
    XCTAssertEqual(editor.core.selection, Selection(anchor: 10, head: 10))
    XCTAssertEqual(origins, [.input])
    editor.paste(origin: .api)
    XCTAssertEqual(editor.core.document.text(), "hello big big world")
    XCTAssertEqual(origins, [.input, .api])
  }

  func testCutIsOneUndoStep() {
    let editor = launch()
    editor.setInitialText("hello world")
    layout(editor)
    editor.core.setSelection(anchor: 0, head: 6)
    editor.cut()
    XCTAssertEqual(editor.core.document.text(), "world")
    XCTAssertEqual(UIPasteboard.general.string, "hello ")
    XCTAssertTrue(editor.core.undo())
    XCTAssertEqual(editor.core.document.text(), "hello world")
    XCTAssertFalse(editor.core.canUndo)
  }
}
