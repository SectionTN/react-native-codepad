import XCTest

@testable import Codepad

final class UndoManagerTests: XCTestCase {
  func testHistoryKeepsAtMostAThousandGroups() {
    let undo = Codepad.UndoManager(clock: { 0 })
    for i in 0..<1001 {
      let change = Change(start: i, removed: "", inserted: "\n", revision: i + 1)
      undo.record(change, before: Selection.caret(i), after: Selection.caret(i + 1), typing: false)
    }
    for _ in 0..<1000 { XCTAssertNotNil(undo.popUndo()) }
    XCTAssertNil(undo.popUndo())
  }
}
