import XCTest

@testable import Codepad

final class ShiftedSpansTests: XCTestCase {
  private let spans = [0, 3, 7, 4, 7, 9]

  // A key inside a token or at its end continues it; the parse decides the real style one frame later.
  func testTypingInsideOrAtTheEndOfASpanGrowsIt() {
    XCTAssertEqual(shiftSpans(spans, start: 2, removed: 0, inserted: 1), [0, 4, 7, 5, 8, 9])
    XCTAssertEqual(shiftSpans(spans, start: 3, removed: 0, inserted: 1), [0, 4, 7, 5, 8, 9])
  }

  // A deletion shrinks the span it sits in and moves the rest back; one spanning two tokens cuts both.
  func testDeletionsShrinkAndReplacementsAcrossSpansCutBoth() {
    XCTAssertEqual(shiftSpans(spans, start: 1, removed: 1, inserted: 0), [0, 2, 7, 3, 6, 9])
    XCTAssertEqual(shiftSpans(spans, start: 2, removed: 3, inserted: 1), [0, 2, 7, 3, 5, 9])
  }

  // A key right before a token moves it without joining it.
  func testTypingBeforeASpanShiftsItWithoutJoiningIt() {
    XCTAssertEqual(shiftSpans(spans, start: 4, removed: 0, inserted: 1), [0, 3, 7, 5, 8, 9])
  }
}
