import UIKit
import XCTest

@testable import Codepad

@MainActor
final class UndoBridgeTests: XCTestCase {
  func testSystemUndoManagerRunsTheCoreGroups() {
    let editor = launch()
    editor.setInitialText("")
    layout(editor)
    let manager = editor.textInput.undoManager
    XCTAssertNotNil(manager)
    XCTAssertTrue(manager === editor.textInput.undoManager, "one manager per editor")
    XCTAssertEqual(manager?.canUndo, false)
    editor.typeText("ab")
    XCTAssertEqual(manager?.canUndo, true)
    manager?.undo()
    XCTAssertEqual(editor.core.document.text(), "")
    XCTAssertEqual(manager?.canRedo, true)
    manager?.redo()
    XCTAssertEqual(editor.core.document.text(), "ab")
  }

  func testReplaceAllUndoesInOneStep() throws {
    let editor = launch()
    editor.setInitialText("a b a")
    layout(editor)
    try editor.setSearch(SearchQuery(text: "a"))
    XCTAssertEqual(editor.replaceAll("x"), 2)
    XCTAssertEqual(editor.core.document.text(), "x b x")
    XCTAssertEqual(editor.textInput.undoManager?.canUndo, true)
    editor.textInput.undoManager?.undo()
    XCTAssertEqual(editor.core.document.text(), "a b a")
    XCTAssertEqual(editor.textInput.undoManager?.canUndo, false)
  }
}
