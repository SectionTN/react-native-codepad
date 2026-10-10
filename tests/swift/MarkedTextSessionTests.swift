import Foundation
import XCTest

@testable import Codepad

final class MarkedTextSessionTests: XCTestCase {
  private func session(_ text: String = "", caret: Int? = nil) -> (EditorCore, MarkedTextSession) {
    let core = EditorCore(text)
    let c = caret ?? text.utf16.count
    core.setSelection(anchor: c, head: c)
    return (core, MarkedTextSession(core: core))
  }

  private func mark(_ s: MarkedTextSession, _ text: String, caret: Int? = nil) {
    s.setMarkedText(text, selectedRange: NSRange(location: caret ?? text.utf16.count, length: 0))
  }

  func testComposingGrowsByOneCharEdits() {
    let (core, s) = session()
    var changes: [Change] = []
    core.onChange = { c, _ in changes.append(c) }
    mark(s, "h")
    mark(s, "he")
    mark(s, "hel")
    XCTAssertEqual(core.document.text(), "hel")
    XCTAssertEqual(s.marked, TextRange(start: 0, end: 3))
    XCTAssertEqual(changes.map { $0.inserted }, ["h", "e", "l"])
    XCTAssertEqual(core.selection, Selection(anchor: 3, head: 3))
    changes.removeAll()
    mark(s, "heL")
    XCTAssertEqual(changes.count, 1)
    XCTAssertEqual(changes[0].start, 2)
    XCTAssertEqual(changes[0].removed, "l")
    XCTAssertEqual(changes[0].inserted, "L")
    mark(s, "heL")
    XCTAssertEqual(changes.count, 1)
  }

  func testComposingNeverSplitsASurrogatePair() {
    let (core, s) = session()
    var changes: [Change] = []
    core.onChange = { c, _ in changes.append(c) }
    mark(s, "a")
    mark(s, "a\u{1F600}")
    mark(s, "a")
    XCTAssertEqual(changes.map { $0.inserted }, ["a", "\u{1F600}", ""])
    XCTAssertEqual(changes.map { $0.removed }, ["", "", "\u{1F600}"])
    XCTAssertEqual(changes.map { $0.start }, [0, 1, 1])
    XCTAssertEqual(core.document.text(), "a")
    XCTAssertEqual(s.marked, TextRange(start: 0, end: 1))
    changes.removeAll()
    mark(s, "\u{1F600}")
    mark(s, "\u{1F609}")
    XCTAssertEqual(changes.last?.removed, "\u{1F600}")
    XCTAssertEqual(changes.last?.inserted, "\u{1F609}")
    XCTAssertEqual(core.document.text(), "\u{1F609}")
  }

  func testUnmarkKeepsTheTextAsOneUndoStep() {
    let (core, s) = session("x ")
    mark(s, "h")
    mark(s, "he")
    mark(s, "hey")
    s.unmarkText()
    XCTAssertEqual(core.document.text(), "x hey")
    XCTAssertNil(s.marked)
    XCTAssertEqual(core.selection, Selection(anchor: 5, head: 5))
    XCTAssertTrue(core.undo())
    XCTAssertEqual(core.document.text(), "x ")
    XCTAssertEqual(core.selection, Selection(anchor: 2, head: 2))
    XCTAssertFalse(core.canUndo)
  }

  func testInsertTextDuringCompositionCommits() {
    let (core, s) = session()
    mark(s, "ni")
    s.insertText("你")
    XCTAssertEqual(core.document.text(), "你")
    XCTAssertNil(s.marked)
    XCTAssertEqual(core.selection, Selection(anchor: 1, head: 1))
    XCTAssertTrue(core.undo())
    XCTAssertEqual(core.document.text(), "")
    XCTAssertFalse(core.canUndo)
  }

  func testReplaceMapsToAnInputEdit() {
    let (core, s) = session("helo.", caret: 4)
    var changes: [(Change, ChangeOrigin)] = []
    core.onChange = { c, o in changes.append((c, o)) }
    s.replace(TextRange(start: 0, end: 4), with: "hello ")
    XCTAssertEqual(core.document.text(), "hello .")
    XCTAssertEqual(core.selection, Selection(anchor: 6, head: 6))
    XCTAssertEqual(changes.map { $0.0.inserted }, ["lo "])
    XCTAssertEqual(changes.map { $0.1 }, [.input])
  }

  func testExternalChangeEndsTheComposition() {
    let (core, s) = session("xx")
    mark(s, "ab")
    XCTAssertEqual(s.marked, TextRange(start: 2, end: 4))
    XCTAssertFalse(s.onExternalChange(core.replace(0, 1, "YY")))
    XCTAssertEqual(s.marked, TextRange(start: 3, end: 5))
    XCTAssertFalse(s.onExternalChange(core.replace(5, 5, "z")))
    XCTAssertEqual(s.marked, TextRange(start: 3, end: 5))
    XCTAssertTrue(s.onExternalChange(core.replace(4, 4, "!")))
    XCTAssertNil(s.marked)
    XCTAssertFalse(s.onExternalChange(core.replace(0, 0, "q")))
  }

  func testSelectionOutsideTheMarkedRangeEndsIt() {
    let (core, s) = session("xyz")
    mark(s, "ab")
    XCTAssertEqual(s.marked, TextRange(start: 3, end: 5))
    s.setSelection(Selection(anchor: 4, head: 4))
    XCTAssertEqual(s.marked, TextRange(start: 3, end: 5))
    XCTAssertEqual(core.selection, Selection(anchor: 4, head: 4))
    s.setSelection(Selection(anchor: 1, head: 1))
    XCTAssertNil(s.marked)
    XCTAssertEqual(core.selection, Selection(anchor: 1, head: 1))
    XCTAssertEqual(core.document.text(), "xyzab")
  }
}
