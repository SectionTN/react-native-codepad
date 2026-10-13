import UIKit
import XCTest

@testable import Codepad

@MainActor
final class LanguageSwitchTests: XCTestCase {
  // A picker sets the text first and the language a frame later, so a frame draws between the switch and
  // the new grammar's snapshot; the heading must still end up painted by the markdown query.
  func testAFrameBetweenTheSwitchAndTheNewSnapshotDoesNotStickToTheOldGrammar() {
    let editor = launch()
    let heading = TokenStyle(color: ThemeColors.color(255, 0, 0), bold: false, italic: false)
    editor.setTheme(ThemeColors.default.withTokens(["markup.heading": heading]))
    editor.setLanguage("javascript")
    editor.setInitialText("let a = 1;")
    layout(editor)
    draw(editor)
    waitForSnapshot(editor)
    editor.setText("# Title\n\nplain text\n", keepHistory: false)
    waitForSnapshot(editor)
    editor.setLanguage("markdown")
    draw(editor)
    waitForSnapshot(editor)
    let image = draw(editor)
    let red = redPixels(image, rows: 40)
    if red == 0 { savePNG(image, "language-switch") }
    XCTAssertGreaterThan(red, 0, "heading painted by the markdown grammar")
  }
}
