import UIKit
import XCTest

@testable import Codepad

@MainActor
final class LanguageSwitchTests: XCTestCase {
  private func redPixels(_ image: UIImage, rows: Int) -> Int {
    let p = Pixels(image)
    var n = 0
    for y in 0..<min(Int(CGFloat(rows) * p.scale), p.height) {
      for x in 0..<p.width {
        let c = p[x, y]
        if c.r > 200 && c.g < 80 && c.b < 80 { n += 1 }
      }
    }
    return n
  }

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
