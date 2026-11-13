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

  // A selection end in a wrapped line above the view gets its layout before the layers are placed. Measured after
  // them, its extra rows would move the scroll under the placed layers and leave the bottom of the view empty.
  func testHandleLineAboveTheViewIsMeasuredBeforeTheLayers() {
    let editor = launch()
    editor.setSoftWrap(true)
    let long = String(repeating: "word ", count: 80)
    editor.setInitialText(([long] + (0..<100).map { "line \($0)" }).joined(separator: "\n"))
    editor.contentOffset = CGPoint(x: 0, y: 600)
    layout(editor)
    editor.focus()
    editor.core.setSelection(anchor: 3, head: editor.core.document.lineStart(30))
    editor.layoutIfNeeded()
    // A relayout drops every layout, so the next draw meets the anchor's line uncached.
    editor.setTextPadding(12)
    let before = editor.contentOffset.y
    editor.layoutIfNeeded()
    let layers = editor.textInput.textHost.sublayers?.compactMap { $0 as? LineLayer } ?? []
    let bottom = layers.map(\.frame.maxY).max() ?? 0
    XCTAssertGreaterThan(editor.contentOffset.y, before, "the wrapped line above grew in this draw")
    XCTAssertGreaterThanOrEqual(bottom, editor.contentOffset.y + editor.bounds.height)
    XCTAssertEqual(editor.latestFrame.scrollY, editor.contentOffset.y)
  }

  func testSystemLollipopsStayInvisible() {
    let editor = launch()
    editor.setContentInsets(top: 20, bottom: 0, left: 0, right: 0)
    editor.setInitialText("hello world")
    layout(editor)
    editor.focus()
    editor.core.setSelection(anchor: 0, head: 5)
    draw(editor)
    let input = editor.textInput
    // The display interaction adds its range adjustment view once the selection is a range; the view masks it.
    let adjustment = { input.subviews.first { NSStringFromClass(type(of: $0)).contains("RangeAdjustment") } }
    spin(until: { adjustment() != nil }, timeout: 3)
    XCTAssertNotNil(adjustment(), "the display interaction never added its range adjustment view")
    XCTAssertNotNil(adjustment()?.layer.mask, "the range adjustment view carries the empty mask")
    // Its lollipops never get a frame, so their 16.5 pt knobs would sit at the content origin, inside the inset here.
    let pixels = Pixels(draw(editor))
    var blue = 0
    for y in 0..<60 {
      for x in 0..<pixels.width {
        let p = pixels[x, y]
        if p.b > 200 && p.r < 80 && p.g < 150 { blue += 1 }
      }
    }
    XCTAssertEqual(blue, 0, "system blue pixels above the content")
  }

  func testTheFontNameFollowsTextsLookup() {
    // UIFont(name:) takes this family's italic face.
    XCTAssertEqual(CodeEditorView.fontName(for: "Avenir Next Condensed"), "AvenirNextCondensed-Regular")
    XCTAssertEqual(CodeEditorView.fontName(for: "Menlo-Bold"), "Menlo-Bold")
    XCTAssertEqual(CodeEditorView.fontName(for: "NoSuchFont"), "Menlo")
    XCTAssertEqual(CodeEditorView.fontName(for: nil), "Menlo")
  }

  func testCaretRectBelowAGapSitsRowsLower() {
    let editor = launch()
    editor.setInitialText("abc\ndef\nghi")
    layout(editor)
    editor.setDecorations([.gap(line: 0, rows: 2)], revision: -1)
    draw(editor)
    let above = editor.textInput.caretRect(for: CPTextPosition(offset: 1))
    let below = editor.textInput.caretRect(for: CPTextPosition(offset: 5))
    XCTAssertEqual(below.minY - above.minY, 3 * above.height, accuracy: 0.5)
  }
}
