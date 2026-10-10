import XCTest

@testable import Codepad

final class UndoManagerTests: XCTestCase {
  func testHistoryKeepsAtMostMaxGroups() {
    let undo = Codepad.UndoManager(clock: { 0 }, maxGroups: 2)
    for i in 0..<3 {
      let change = Change(start: i, removed: "", inserted: "\n", revision: i + 1)
      undo.record(change, before: Selection.caret(i), after: Selection.caret(i + 1), typing: false)
    }
    XCTAssertNotNil(undo.popUndo())
    XCTAssertNotNil(undo.popUndo())
    XCTAssertNil(undo.popUndo())
  }
}
