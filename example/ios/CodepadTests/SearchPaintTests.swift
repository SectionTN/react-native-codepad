import UIKit
import XCTest

@testable import Codepad

@MainActor
final class SearchPaintTests: XCTestCase {
  func testMatchesPaintAfterTheResultLands() throws {
    let editor = launch()
    editor.setInitialText("foo bar foo\nfoo")
    layout(editor)
    try editor.setSearch(SearchQuery(text: "foo"))
    var fresh = false
    editor.whenSearchFresh { fresh = true }
    spin(until: { fresh })
    XCTAssertTrue(fresh, "the worker's result landed")
    draw(editor)
    let d = editor.textInput.decorations
    XCTAssertEqual(rectCount(d.matches.path), 3)
    XCTAssertTrue(d.activeMatch.isHidden)
    XCTAssertNotNil(editor.findNext())
    let sel = editor.core.selection
    XCTAssertEqual(sel.max - sel.min, 3, "a match is selected")
    draw(editor)
    XCTAssertEqual(rectCount(d.matches.path), 2)
    XCTAssertEqual(rectCount(d.activeMatch.path), 1)
    XCTAssertFalse(d.activeMatch.isHidden)
    XCTAssertEqual(d.activeMatch.fillColor?.components, ThemeColors.default.searchMatchActive.components)
    editor.clearSearch()
    draw(editor)
    XCTAssertTrue(d.matches.isHidden)
    XCTAssertTrue(d.activeMatch.isHidden)
  }

  func testBracketPairPaintsBothBrackets() {
    let editor = launch()
    editor.setInitialText("f(a)")
    layout(editor)
    editor.core.setSelection(anchor: 1, head: 1)
    draw(editor)
    let d = editor.textInput.decorations
    XCTAssertFalse(d.brackets.isHidden)
    XCTAssertEqual(rectCount(d.brackets.path), 2)
    editor.setMatchBrackets(false)
    draw(editor)
    XCTAssertTrue(d.brackets.isHidden)
  }
}
