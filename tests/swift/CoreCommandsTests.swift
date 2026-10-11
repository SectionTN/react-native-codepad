import XCTest

@testable import Codepad

final class CoreCommandsTests: XCTestCase {
  func testMovesAndEdits() {
    let core = EditorCore("ab cd")
    XCTAssertTrue(CoreCommands.run(core, .move(unit: .word, forward: true, extend: false)))
    XCTAssertEqual(core.selection, Selection(anchor: 2, head: 2))
    XCTAssertTrue(CoreCommands.run(core, .move(unit: .lineEnd, forward: true, extend: true)))
    XCTAssertEqual(core.selection, Selection(anchor: 2, head: 5))
    XCTAssertTrue(CoreCommands.run(core, .escape))
    XCTAssertEqual(core.selection, Selection(anchor: 5, head: 5))
    XCTAssertTrue(CoreCommands.run(core, .backspace))
    XCTAssertEqual(core.document.text(), "ab c")
    XCTAssertTrue(CoreCommands.run(core, .undo))
    XCTAssertEqual(core.document.text(), "ab cd")
    XCTAssertTrue(CoreCommands.run(core, .redo))
    XCTAssertEqual(core.document.text(), "ab c")
    XCTAssertTrue(CoreCommands.run(core, .selectAll))
    XCTAssertEqual(core.selection, Selection(anchor: 0, head: 4))
    XCTAssertTrue(CoreCommands.run(core, .delete))
    XCTAssertEqual(core.document.text(), "")
    XCTAssertTrue(CoreCommands.run(core, .newline))
    XCTAssertEqual(core.document.text(), "\n")
    XCTAssertTrue(CoreCommands.run(core, .tab))
    XCTAssertEqual(core.document.text(), "\n    ")
    XCTAssertTrue(CoreCommands.run(core, .shiftTab))
    XCTAssertEqual(core.document.text(), "\n")
  }

  func testViewCommandsAreNotHandled() {
    let core = EditorCore("x")
    XCTAssertFalse(CoreCommands.run(core, .vertical(direction: 1, page: false, extend: false)))
    XCTAssertFalse(CoreCommands.run(core, .copy))
    XCTAssertFalse(CoreCommands.run(core, .cut))
    XCTAssertFalse(CoreCommands.run(core, .paste))
    XCTAssertEqual(core.document.text(), "x")
  }
}
