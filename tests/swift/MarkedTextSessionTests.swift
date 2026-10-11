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
    let (core2, s2) = session("helo.", caret: 4)
    var replaced: [(Change, ChangeOrigin)] = []
    core2.onChange = { c, o in replaced.append((c, o)) }
    s2.replace(TextRange(start: 0, end: 4), with: "hello ")
    XCTAssertEqual(core2.document.text(), "hello .")
    XCTAssertEqual(core2.selection, Selection(anchor: 6, head: 6))
    XCTAssertEqual(replaced.map { $0.0.inserted }, ["lo "])
    XCTAssertEqual(replaced.map { $0.1 }, [.input])
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
    // A commit through insertText during a composition is one step as well.
    let (core2, s2) = session()
    mark(s2, "ni")
    s2.insertText("\u{4F60}")
    XCTAssertEqual(core2.document.text(), "\u{4F60}")
    XCTAssertNil(s2.marked)
    XCTAssertEqual(core2.selection, Selection(anchor: 1, head: 1))
    XCTAssertTrue(core2.undo())
    XCTAssertEqual(core2.document.text(), "")
    XCTAssertFalse(core2.canUndo)
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

  // The iOS keyboard deletes by selecting the previous character first, then calling deleteBackward.
  func testKeyboardBackspaceAfterSelectingTheOpenerRemovesThePair() {
    let (core, s) = session("a()", caret: 2)
    s.setSelection(Selection(anchor: 1, head: 2))
    s.deleteBackward()
    XCTAssertEqual(core.document.text(), "a")
    XCTAssertEqual(core.selection, Selection.caret(1))
  }

  func testKeyboardBackspaceCoalescesLikeTyping() {
    let (core, s) = session("abc", caret: 3)
    s.setSelection(Selection(anchor: 2, head: 3))
    s.deleteBackward()
    s.setSelection(Selection(anchor: 1, head: 2))
    s.deleteBackward()
    XCTAssertEqual(core.document.text(), "a")
    core.undo()
    XCTAssertEqual(core.document.text(), "abc")
  }

  func testBackspaceOverASelectionTheKeyboardDidNotMakeDeletesIt() {
    let (core, s) = session("a()", caret: 2)
    core.setSelection(anchor: 1, head: 2)
    s.deleteBackward()
    XCTAssertEqual(core.document.text(), "a)")
    XCTAssertEqual(core.selection, Selection.caret(1))
  }
}
