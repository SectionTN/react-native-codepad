import XCTest

@testable import Codepad

@MainActor
final class HitTestTests: XCTestCase {
  func testPointsMapBackToTheOffsetsTheyWereDrawnAt() {
    let editor = launch()
    editor.setLineNumbers(false)
    editor.setInitialText("abcdef\n" + String(repeating: "x", count: 80))
    for wrap in [false, true] {
      editor.setSoftWrap(wrap)
      layout(editor)
      for offset in [0, 3, 6, 7, 40, 87] {
        editor.core.setSelection(anchor: offset, head: offset)
        draw(editor)
        guard let caret = editor.latestFrame.caret else {
          XCTFail("no caret rect at \(offset)")
          return
        }
        XCTAssertEqual(editor.offsetAt(x: caret.minX + 2, y: caret.midY), offset, "wrap \(wrap) offset \(offset)")
      }
      editor.core.setSelection(anchor: 0, head: 0)
      draw(editor)
      guard let caret = editor.latestFrame.caret else {
        XCTFail("no caret")
        return
      }
      let row0 = caret.minY + 2
      XCTAssertEqual(editor.offsetAt(x: 299, y: row0), 6, "wrap \(wrap) far right")
      XCTAssertEqual(editor.offsetAt(x: 0, y: row0), 0, "wrap \(wrap) far left")
      // The wrapped rows can outgrow the view, so probe just past the content, not a fixed y.
      let below = editor.latestFrame.contentHeight + 10
      XCTAssertEqual(editor.offsetAt(x: 150, y: below), editor.core.document.length, "wrap \(wrap) below")
    }
  }
}
