import UIKit
import XCTest

@testable import Codepad

@MainActor
final class HardwareKeysTests: XCTestCase {
  func testKeysMoveEditAndUndo() {
    let editor = launch()
    editor.setInitialText("ab cd")
    layout(editor)
    editor.perform(.move(unit: .char, forward: true, extend: true))
    XCTAssertEqual(editor.core.selection, Selection(anchor: 0, head: 1))
    editor.perform(.move(unit: .docEnd, forward: true, extend: false))
    XCTAssertEqual(editor.core.selection, Selection(anchor: 5, head: 5))
    editor.perform(.backspace)
    XCTAssertEqual(editor.core.document.text(), "ab c")
    editor.perform(.undo)
    XCTAssertEqual(editor.core.document.text(), "ab cd")
    editor.perform(.redo)
    XCTAssertEqual(editor.core.document.text(), "ab c")
    editor.perform(.selectAll)
    XCTAssertEqual(editor.core.selection, Selection(anchor: 0, head: 4))
    editor.textInput.insertText("x")
    XCTAssertEqual(editor.core.document.text(), "x")
    editor.textInput.insertText("\n")
    XCTAssertEqual(editor.core.document.text(), "x\n")
  }

  func testKeyCommandsTableCoversEveryMappedCombination() {
    let editor = launch()
    let commands = editor.textInput.keyCommands ?? []
    let inputs: [(Key, String)] = [
      (.left, UIKeyCommand.inputLeftArrow), (.right, UIKeyCommand.inputRightArrow), (.up, UIKeyCommand.inputUpArrow),
      (.down, UIKeyCommand.inputDownArrow), (.home, UIKeyCommand.inputHome), (.end, UIKeyCommand.inputEnd),
      (.pageUp, UIKeyCommand.inputPageUp), (.pageDown, UIKeyCommand.inputPageDown), (.escape, UIKeyCommand.inputEscape),
      (.tab, "\t"), (.letter("z"), "z"), (.letter("a"), "a"), (.letter("c"), "c"), (.letter("x"), "x"), (.letter("v"), "v"),
    ]
    let modifiers: [(Modifiers, UIKeyModifierFlags)] = [
      ([], []), (.shift, .shift), (.option, .alternate), (.command, .command), ([.shift, .option], [.shift, .alternate]),
      ([.shift, .command], [.shift, .command]), ([.option, .command], [.alternate, .command]),
      ([.shift, .option, .command], [.shift, .alternate, .command]),
    ]
    var mapped = 0
    for (key, input) in inputs {
      for (mods, flags) in modifiers where KeyCommands.map(key, mods) != nil {
        mapped += 1
        let match = commands.first { $0.input == input && $0.modifierFlags == flags }
        XCTAssertNotNil(match, "\(key) with \(mods) has a key command")
        XCTAssertEqual(match?.wantsPriorityOverSystemBehavior, true, "\(key) with \(mods) beats the system")
      }
    }
    XCTAssertEqual(commands.count, mapped, "one command per mapped combination")
  }

  func testVerticalMovementKeepsTheColumn() {
    let editor = launch()
    editor.setInitialText("abcdef\nxy\nlonger")
    layout(editor)
    editor.core.setSelection(anchor: 4, head: 4)
    editor.perform(.vertical(direction: 1, page: false, extend: false))
    XCTAssertEqual(editor.core.selection, Selection(anchor: 9, head: 9))
    editor.perform(.vertical(direction: 1, page: false, extend: false))
    XCTAssertEqual(editor.core.selection, Selection(anchor: 14, head: 14))
    editor.perform(.vertical(direction: -1, page: false, extend: true))
    XCTAssertEqual(editor.core.selection, Selection(anchor: 14, head: 9))
    editor.perform(.vertical(direction: -1, page: true, extend: false))
    XCTAssertEqual(editor.core.selection, Selection(anchor: 0, head: 0))
  }

  func testReadOnlyIgnoresEditingKeysOnly() {
    let editor = launch()
    editor.setInitialText("ab")
    layout(editor)
    editor.setReadOnly(true)
    editor.perform(.backspace)
    editor.textInput.insertText("q")
    XCTAssertEqual(editor.core.document.text(), "ab")
    editor.perform(.selectAll)
    XCTAssertEqual(editor.core.selection, Selection(anchor: 0, head: 2))
  }

  func testForwardDeleteArrivesThroughPresses() {
    let editor = launch()
    editor.setInitialText("abc")
    layout(editor)
    editor.core.setSelection(anchor: 1, head: 1)
    let input = editor.textInput
    XCTAssertTrue(input.handle(hidUsage: .keyboardDeleteForward, modifiers: []))
    XCTAssertEqual(editor.core.document.text(), "ac")
    XCTAssertFalse(input.handle(hidUsage: .keyboardA, modifiers: []), "letters take the text path")
    editor.setReadOnly(true)
    XCTAssertTrue(input.handle(hidUsage: .keyboardDeleteForward, modifiers: []), "consumed under read only")
    XCTAssertEqual(editor.core.document.text(), "ac")
  }
}
