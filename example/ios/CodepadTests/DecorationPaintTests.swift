import UIKit
import XCTest

@testable import Codepad

@MainActor
final class DecorationPaintTests: XCTestCase {
  private let red: UInt32 = 0xFFC8_322B
  private let tint: UInt32 = 0xFFFA_E8E6

  private func near(_ c: (r: Int, g: Int, b: Int, a: Int), _ argb: UInt32) -> Bool {
    abs(c.r - Int((argb >> 16) & 0xff)) <= 3 && abs(c.g - Int((argb >> 8) & 0xff)) <= 3 && abs(c.b - Int(argb & 0xff)) <= 3
  }

  private func caretLeft(_ editor: CodeEditorView, _ offset: Int) -> CGFloat {
    editor.core.setSelection(anchor: offset, head: offset)
    draw(editor)
    return editor.latestFrame.caret?.minX ?? .nan
  }

  private func theme(activeLine: CGColor) -> ThemeColors {
    let d = ThemeColors.default
    return ThemeColors(
      background: d.background, foreground: d.foreground, gutterBackground: d.gutterBackground,
      gutterForeground: d.gutterForeground, gutterActiveForeground: d.gutterActiveForeground, activeLine: activeLine,
      selection: d.selection, cursor: d.cursor, matchingBracket: d.matchingBracket, searchMatch: d.searchMatch,
      searchMatchActive: d.searchMatchActive, tokens: [:])
  }

  func testSolidUnderlineSitsOffsetBelowTheBaseline() {
    let editor = launch()
    editor.setLineNumbers(false)
    editor.setInitialText("if T[j] < T[i]:")
    layout(editor)
    // The middle of the T at offset 10: its lowest ink row sits on the baseline.
    let mid = (caretLeft(editor, 10) + caretLeft(editor, 11)) / 2
    editor.core.setSelection(anchor: 0, head: 0)
    let plain = Pixels(draw(editor))
    let x = Int(mid * plain.scale)
    guard let lowest = (0..<plain.height).last(where: { plain[x, $0].b < 100 }) else { return XCTFail("no glyph ink") }
    let baseline = lowest + 1
    editor.setDecorations(
      [.underline(Underline(start: 10, end: 14, color: red, style: .solid, thickness: 2, offset: 4))], revision: -1)
    let lit = Pixels(draw(editor))
    let rows = (0..<lit.height).filter { near(lit[x, $0], red) }
    guard let top = rows.first else { return XCTFail("no underline under the T") }
    XCTAssertEqual(CGFloat(top - baseline), 4 * lit.scale, accuracy: 1.5, "top below the baseline")
    XCTAssertEqual(CGFloat(rows.count), 2 * lit.scale, accuracy: 1.5, "thickness")
  }

  func testLineBackgroundCoversTheActiveLine() {
    let blue = ThemeColors.color(0, 0, 255)
    let editor = launch()
    editor.setLineNumbers(false)
    editor.setTheme(theme(activeLine: blue))
    editor.setHighlightActiveLine(true)
    editor.setInitialText("a\nb\nc")
    layout(editor)
    _ = caretLeft(editor, 2)
    guard let caret = editor.latestFrame.caret else { return XCTFail("no caret") }
    let before = Pixels(draw(editor))
    let x = before.width - 4
    let y = Int(caret.midY * before.scale)
    XCTAssertTrue(near(before[x, y], 0xFF00_00FF), "active line under the caret, got \(before[x, y])")
    editor.setDecorations([.lineBackground(line: 1, color: tint)], revision: -1)
    let after = Pixels(draw(editor))
    XCTAssertTrue(near(after[x, y], tint), "line background over the active line")
  }

  func testUnderlineMovesWithHorizontalScroll() {
    let editor = launch()
    editor.setLineNumbers(false)
    editor.setSoftWrap(false)
    editor.setInitialText(String(repeating: "x", count: 200))
    layout(editor)
    editor.setDecorations(
      [
        .lineBackground(line: 0, color: tint),
        .underline(Underline(start: 185, end: 195, color: red, style: .solid, thickness: 2, offset: 4)),
      ], revision: -1)
    editor.core.setSelection(anchor: 195, head: 185)
    editor.revealSelection()
    let p = Pixels(draw(editor))
    XCTAssertGreaterThan(editor.latestFrame.scrollX, 0, "scrolled sideways")
    guard let caret = editor.latestFrame.caret else { return XCTFail("no caret") }
    let band = (0..<p.height).filter { y in (0..<p.width).contains { near(p[$0, y], red) } }
    guard !band.isEmpty else { return XCTFail("no underline") }
    let y = band[band.count / 2]
    guard let left = (0..<p.width).first(where: { near(p[$0, y], red) }) else { return XCTFail("no underline row") }
    XCTAssertEqual(CGFloat(left), caret.minX * p.scale, accuracy: 1.5, "underline starts under its first character")
    // Just under the row top, above any glyph ink.
    XCTAssertTrue(near(p[1, Int(caret.minY * p.scale) + 1], tint), "line background stays at the left edge")
  }
}
