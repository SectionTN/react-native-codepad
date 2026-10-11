import XCTest

@testable import Codepad

final class KeyCommandsTests: XCTestCase {
  private let shift: Modifiers = [.shift]
  private let command: Modifiers = [.command]

  func testArrowsMoveByCharWordAndRow() {
    XCTAssertEqual(KeyCommands.map(.right, []), .move(unit: .char, forward: true, extend: false))
    XCTAssertEqual(KeyCommands.map(.left, [.option, .shift]), .move(unit: .word, forward: false, extend: true))
    XCTAssertEqual(KeyCommands.map(.right, [.option]), .move(unit: .word, forward: true, extend: false))
    XCTAssertEqual(KeyCommands.map(.left, command), .move(unit: .lineStart, forward: false, extend: false))
    XCTAssertEqual(KeyCommands.map(.right, [.command, .shift]), .move(unit: .lineEnd, forward: true, extend: true))
    XCTAssertEqual(KeyCommands.map(.up, shift), .vertical(direction: -1, page: false, extend: true))
    XCTAssertEqual(KeyCommands.map(.down, []), .vertical(direction: 1, page: false, extend: false))
    XCTAssertEqual(KeyCommands.map(.up, command), .move(unit: .docStart, forward: false, extend: false))
    XCTAssertEqual(KeyCommands.map(.down, [.command, .shift]), .move(unit: .docEnd, forward: true, extend: true))
    XCTAssertEqual(KeyCommands.map(.pageDown, []), .vertical(direction: 1, page: true, extend: false))
    XCTAssertEqual(KeyCommands.map(.pageUp, shift), .vertical(direction: -1, page: true, extend: true))
    XCTAssertEqual(KeyCommands.map(.home, []), .move(unit: .lineStart, forward: false, extend: false))
    XCTAssertEqual(KeyCommands.map(.end, shift), .move(unit: .lineEnd, forward: true, extend: true))
    XCTAssertEqual(KeyCommands.map(.home, command), .move(unit: .docStart, forward: false, extend: false))
    XCTAssertEqual(KeyCommands.map(.end, [.command, .shift]), .move(unit: .docEnd, forward: true, extend: true))
  }

  func testEditingShortcuts() {
    XCTAssertEqual(KeyCommands.map(.letter("z"), command), .undo)
    XCTAssertEqual(KeyCommands.map(.letter("z"), [.command, .shift]), .redo)
    XCTAssertEqual(KeyCommands.map(.letter("a"), command), .selectAll)
    XCTAssertEqual(KeyCommands.map(.letter("c"), command), .copy)
    XCTAssertEqual(KeyCommands.map(.letter("x"), command), .cut)
    XCTAssertEqual(KeyCommands.map(.letter("v"), command), .paste)
    XCTAssertEqual(KeyCommands.map(.letter("V"), command), .paste)
    XCTAssertEqual(KeyCommands.map(.tab, []), .tab)
    XCTAssertEqual(KeyCommands.map(.tab, shift), .shiftTab)
    XCTAssertEqual(KeyCommands.map(.enter, shift), .newline)
    XCTAssertEqual(KeyCommands.map(.backspace, []), .backspace)
    XCTAssertEqual(KeyCommands.map(.forwardDelete, []), .delete)
    XCTAssertEqual(KeyCommands.map(.escape, []), .escape)
  }

  func testUnmappedKeys() {
    XCTAssertNil(KeyCommands.map(.letter("z"), []))
    XCTAssertNil(KeyCommands.map(.letter("z"), shift))
    XCTAssertNil(KeyCommands.map(.letter("a"), [.command, .shift]))
    XCTAssertNil(KeyCommands.map(.letter("y"), command))
    XCTAssertNil(KeyCommands.map(.tab, command))
    XCTAssertNil(KeyCommands.map(.tab, [.option]))
    XCTAssertNil(KeyCommands.map(.left, [.control]))
    XCTAssertNil(KeyCommands.map(.letter("v"), [.command, .control]))
    XCTAssertNil(KeyCommands.map(.letter("q"), []))
  }

  func testEditsFlag() {
    XCTAssertTrue(KeyCommand.paste.edits)
    XCTAssertTrue(KeyCommand.newline.edits)
    XCTAssertTrue(KeyCommand.undo.edits)
    XCTAssertFalse(KeyCommand.copy.edits)
    XCTAssertFalse(KeyCommand.selectAll.edits)
    XCTAssertFalse(KeyCommand.escape.edits)
    XCTAssertFalse(KeyCommand.move(unit: .char, forward: true, extend: false).edits)
    XCTAssertFalse(KeyCommand.vertical(direction: 1, page: false, extend: false).edits)
  }
}
