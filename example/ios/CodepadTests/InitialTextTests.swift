import UIKit
import XCTest

@testable import Codepad

@MainActor
final class InitialTextTests: XCTestCase {
  // A new document starts at revision 0 like the old one, so a kept snapshot passes the revision check in prepare
  // and the lines laid out from it never pick up the real one.
  func testANewInitialTextDropsTheSnapshotOfTheOldDocument() {
    let editor = launch()
    let heading = TokenStyle(color: ThemeColors.color(255, 0, 0), bold: false, italic: false)
    editor.setTheme(ThemeColors.default.withTokens(["markup.heading": heading]))
    editor.setLanguage("markdown")
    editor.setInitialText("plain text\n")
    layout(editor)
    draw(editor)
    waitForSnapshot(editor)
    editor.setInitialText("# Title\n")
    XCTAssertEqual(editor.snapshotRevision, -1, "the old document's snapshot is gone")
    draw(editor)
    waitForSnapshot(editor)
    let image = draw(editor)
    let red = redPixels(image, rows: 40)
    if red == 0 { savePNG(image, "initial-text") }
    XCTAssertGreaterThan(red, 0, "heading painted after the second initial text")
  }
}
