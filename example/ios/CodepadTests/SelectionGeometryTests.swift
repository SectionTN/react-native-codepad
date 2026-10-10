import CoreText
import UIKit
import XCTest

@testable import Codepad

@MainActor
final class SelectionGeometryTests: XCTestCase {
  private let menlo16 = CTFontCreateWithName("Menlo" as CFString, 16, nil)

  private var oneDark: ThemeColors {
    ThemeColors(
      background: ThemeColors.color(0x28, 0x2c, 0x34), foreground: ThemeColors.color(0xab, 0xb2, 0xbf),
      gutterBackground: ThemeColors.color(0x28, 0x2c, 0x34), gutterForeground: ThemeColors.color(0x4b, 0x52, 0x63),
      gutterActiveForeground: ThemeColors.color(0xab, 0xb2, 0xbf), activeLine: ThemeColors.color(0x2c, 0x31, 0x3c),
      selection: ThemeColors.color(0x3e, 0x44, 0x51), cursor: ThemeColors.color(0x52, 0x8b, 0xff),
      matchingBracket: ThemeColors.color(0x51, 0x5a, 0x6b), searchMatch: ThemeColors.color(0xe5, 0xc0, 0x7b, 0.4),
      searchMatchActive: ThemeColors.color(0xe5, 0xc0, 0x7b, 0.7), tokens: [:])
  }

  func testCaretRectFollowsTheLayout() {
    let editor = launch()
    editor.setInitialText("abc\ndef")
    layout(editor)
    draw(editor)
    let rect = editor.textInput.caretRect(for: CPTextPosition(offset: 5))
    XCTAssertEqual(rect.minX, 8 + RowMetrics.advance(of: "d", in: menlo16), accuracy: 0.5)
    XCTAssertEqual(rect.minY, 22, accuracy: 0.5)
    XCTAssertEqual(rect.width, 2)
    XCTAssertEqual(rect.height, 22, accuracy: 0.5)
  }

  func testSelectionRectsCoverEachRow() {
    let editor = launch()
    editor.setInitialText("ab\ncd\nef")
    layout(editor)
    draw(editor)
    let rects = editor.textInput.selectionRects(for: CPTextRange(start: 1, end: 7))
    XCTAssertEqual(rects.count, 3)
    guard rects.count == 3 else { return }
    XCTAssertTrue(rects[0].containsStart)
    XCTAssertFalse(rects[0].containsEnd)
    XCTAssertFalse(rects[1].containsStart)
    XCTAssertFalse(rects[1].containsEnd)
    XCTAssertFalse(rects[2].containsStart)
    XCTAssertTrue(rects[2].containsEnd)
    XCTAssertEqual(rects[1].rect.minY, 22, accuracy: 0.5)
    XCTAssertEqual(rects[2].rect.minX, 8, accuracy: 0.5)
  }

  func testThemeChangeRecolorsTheSelectionViews() {
    let editor = launch()
    editor.setInitialText("hello")
    layout(editor)
    editor.focus()
    editor.core.setSelection(anchor: 0, head: 5)
    draw(editor)
    let theme = oneDark
    editor.setTheme(theme)
    let input = editor.textInput
    XCTAssertEqual(input.highlightView.fillColor?.components, theme.selection.components)
    XCTAssertEqual(input.cursorView.color.components, theme.cursor.components)
    XCTAssertEqual(input.handleViews.count, 2)
    for handle in input.handleViews { XCTAssertEqual(handle.color.components, theme.cursor.components) }
  }
}

extension SelectionGeometryTests {
  func testHandlesWrapTheSelectionEnds() {
    let editor = launch()
    editor.setInitialText("hello world")
    layout(editor)
    editor.focus()
    editor.core.setSelection(anchor: 0, head: 5)
    draw(editor)
    let input = editor.textInput
    let handles = input.handleViews
    XCTAssertEqual(handles.map(\.direction), [.leading, .trailing])
    XCTAssertEqual(handles.map(\.superview), [input, input])
    XCTAssertEqual(handles.map(\.isHidden), [false, false])
    XCTAssertEqual(handles[0].frame, handles[0].preferredFrame(for: editor.caretRect(offset: 0)))
    XCTAssertEqual(handles[1].frame, handles[1].preferredFrame(for: editor.caretRect(offset: 5)))
    editor.core.setSelection(anchor: 5, head: 5)
    draw(editor)
    XCTAssertEqual(handles.map(\.isHidden), [true, true], "no handles on a collapsed selection")
  }
}
