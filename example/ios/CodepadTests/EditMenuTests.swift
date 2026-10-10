import UIKit
import XCTest

@testable import Codepad

@MainActor
final class EditMenuTests: XCTestCase {
  private let actions: [(String, Selector)] = [
    ("cut", #selector(UIResponderStandardEditActions.cut(_:))),
    ("copy", #selector(UIResponderStandardEditActions.copy(_:))),
    ("paste", #selector(UIResponderStandardEditActions.paste(_:))),
    ("selectAll", #selector(UIResponderStandardEditActions.selectAll(_:))),
  ]

  private func allowed(_ input: TextInputView) -> [String] {
    actions.filter { input.canPerformAction($0.1, withSender: nil) }.map(\.0)
  }

  func testCanPerformActionMatrix() {
    let editor = launch()
    editor.setInitialText("hello world")
    layout(editor)
    let input = editor.textInput
    UIPasteboard.general.string = "x"
    editor.core.setSelection(anchor: 0, head: 5)
    XCTAssertEqual(allowed(input), ["cut", "copy", "paste", "selectAll"])
    editor.core.setSelection(anchor: 3, head: 3)
    XCTAssertEqual(allowed(input), ["paste", "selectAll"])
    editor.setReadOnly(true)
    editor.core.setSelection(anchor: 0, head: 5)
    XCTAssertEqual(allowed(input), ["copy", "selectAll"])
    editor.setReadOnly(false)
    UIPasteboard.general.items = []
    XCTAssertEqual(allowed(input), ["cut", "copy", "selectAll"])
  }

  func testMenuShowsAtTheSelectionRectWhenAsked() {
    let editor = launch()
    editor.setInitialText("hello world\nsecond line")
    UIPasteboard.general.string = "x"
    layout(editor)
    editor.focus()
    editor.core.setSelection(anchor: 0, head: 5)
    draw(editor)
    let input = editor.textInput
    let caret = editor.caretRect(offset: 2)
    let machine = input.gestures.machine
    machine.down(x: caret.midX, y: caret.midY, time: 0)
    machine.up(x: caret.midX, y: caret.midY, time: 0.05)
    spin(until: { input.menu.isShowing })
    XCTAssertTrue(input.menu.isShowing)
    XCTAssertEqual(Set(input.menu.itemTitles), ["Cut", "Copy", "Paste", "Select All"])
    let rects = editor.selectionRects(start: 0, end: 5).map(\.rect)
    XCTAssertEqual(input.menu.targetRect, rects.dropFirst().reduce(rects[0]) { $0.union($1) })
  }

  func testEditAndBlurHideTheMenu() {
    let editor = launch()
    editor.setInitialText("hello world")
    layout(editor)
    editor.focus()
    editor.core.setSelection(anchor: 0, head: 5)
    draw(editor)
    let input = editor.textInput
    input.showMenu()
    spin(until: { input.menu.isShowing })
    XCTAssertTrue(input.menu.isShowing)
    editor.core.typeText("x")
    spin(until: { !input.menu.isShowing })
    XCTAssertFalse(input.menu.isShowing, "an edit hides the menu")
    editor.core.setSelection(anchor: 0, head: 1)
    input.showMenu()
    spin(until: { input.menu.isShowing })
    XCTAssertTrue(input.menu.isShowing)
    editor.blur()
    spin(until: { !input.menu.isShowing })
    XCTAssertFalse(input.menu.isShowing, "blur hides the menu")
  }
}
