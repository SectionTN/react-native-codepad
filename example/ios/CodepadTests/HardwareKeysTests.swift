import UIKit
import XCTest

@testable import Codepad

@MainActor
final class HardwareKeysTests: XCTestCase {
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
