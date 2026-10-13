import UIKit
import XCTest

@testable import Codepad

@MainActor
final class KeyFrameHighlightTests: XCTestCase {
  // A painter that re-queries only the edited line keeps the declarator's name in the function style.
  func testAChangedValueKindRecolorsTheDeclaratorNameWithTheSnapshot() {
    let editor = launch()
    let function = TokenStyle(color: ThemeColors.color(255, 0, 0), bold: false, italic: false)
    editor.setTheme(ThemeColors.default.withTokens(["function": function]))
    editor.setLanguage("javascript")
    editor.setInitialText("const f =\n  function() {};\n")
    layout(editor)
    draw(editor)
    waitForSnapshot(editor)
    XCTAssertGreaterThan(redPixels(draw(editor), rows: 44), 0, "the name painted in the function style")
    editor.core.replace(12, 25, "1")
    waitForSnapshot(editor)
    let image = draw(editor)
    let red = redPixels(image, rows: 44)
    if red > 0 { savePNG(image, "key-frame-sibling") }
    XCTAssertEqual(red, 0, "the name painted in the variable style")
  }

  // A clean line keeps its layout object across the snapshot; a painter that rebuilds bumped lines replaces it.
  func testAnEditOnOneLineKeepsTheOtherLinesLayouts() throws {
    let editor = launch()
    editor.setLanguage("javascript")
    editor.setInitialText("let a = 1;\nlet b = 2;\nlet c = 3;\n")
    layout(editor)
    draw(editor)
    waitForSnapshot(editor)
    draw(editor)
    let layers = try XCTUnwrap(editor.textInput.textHost.sublayers).compactMap { $0 as? LineLayer }
    let third = try XCTUnwrap(layers.first { $0.frame.minY == 44 })
    let first = try XCTUnwrap(layers.first { $0.frame.minY == 0 })
    let kept = try XCTUnwrap(third.layout)
    let replaced = try XCTUnwrap(first.layout)
    editor.core.replace(8, 9, "10")
    waitForSnapshot(editor)
    draw(editor)
    XCTAssertTrue(third.layout === kept)
    XCTAssertFalse(first.layout === replaced)
  }
}
