import XCTest

@testable import Codepad

final class UndoManagerTests: XCTestCase {
  func testHistoryKeepsAtMostAThousandGroups() {
    let core = EditorCore("", clock: { 0 })
    for i in 0..<1001 { core.replace(i, i, "\n") }
    for _ in 0..<1000 { XCTAssertTrue(core.undo()) }
    XCTAssertFalse(core.undo())
    XCTAssertEqual(core.document.length, 1)
  }
}
