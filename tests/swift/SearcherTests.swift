import CodepadCore
import XCTest

@testable import Codepad

final class SearcherTests: XCTestCase {
  private func compiled(_ text: String, _ query: SearchQuery) throws -> (TextSnapshot, CompiledSearch) {
    let core = EditorCore(text)
    try core.setSearch(query)
    return (core.textSnapshot(), try XCTUnwrap(core.compiledSearch()))
  }

  // A job cancelled by an edit must stop at the next batch instead of scanning the rest of the document.
  func testCancelBetweenBatches() throws {
    let (text, search) = try compiled(String(repeating: "a", count: 100_000), SearchQuery(text: "a"))
    var asked = 0
    XCTAssertThrowsError(
      try Searcher.find(text, search) {
        asked += 1
        return asked > 1
      }
    ) { error in
      XCTAssertTrue(error is CancellationError, "\(error)")
    }
    XCTAssertEqual(asked, 2)
  }

  // Catastrophic backtracking ends at PCRE2's match limit instead of holding the search worker forever.
  // The bound is loose because TSan runs the limit's 10M steps in about 8 s. Without a limit it never ends.
  func testPathologicalPatternEnds() throws {
    let (text, search) = try compiled(String(repeating: "a", count: 40) + "b", SearchQuery(text: "(a+)+$", regex: true))
    let started = Date()
    let result = try Searcher.find(text, search)
    XCTAssertLessThan(Date().timeIntervalSince(started), 60)
    XCTAssertEqual(result.matches, [])
    XCTAssertTrue(result.limited)
  }

  // A limit hit after a match ends the scan as limited instead of reading as the end of the text.
  func testALimitAfterAMatchEndsTheScanAsLimited() throws {
    let text = "aa\n" + String(repeating: "a", count: 40) + "b\naaa"
    let (snapshot, search) = try compiled(text, SearchQuery(text: "(a+)+$", regex: true))
    let result = try Searcher.find(snapshot, search)
    XCTAssertEqual(result.matches, [0, 2])
    XCTAssertTrue(result.limited)
  }

  // A costly pattern that never matches still reaches the cancel check while it scans.
  func testCancelLandsInsideAScanWithNoMatch() throws {
    let lines = Array(repeating: String(repeating: "a", count: 18) + "b", count: 40).joined(separator: "\n")
    let (text, search) = try compiled(lines, SearchQuery(text: "(a+)+$", regex: true))
    var asked = 0
    XCTAssertThrowsError(
      try Searcher.find(text, search) {
        asked += 1
        return asked > 1
      }
    ) { error in
      XCTAssertTrue(error is CancellationError, "\(error)")
    }
  }

  // Each match call must not pass over the rest of the text again. The bound is loose for TSan, and a pass per
  // match takes about 17 s here.
  func testManyMatchesScanInLinearTime() throws {
    let (text, search) = try compiled(String(repeating: "a", count: 150_000), SearchQuery(text: "a"))
    let started = Date()
    let result = try Searcher.find(text, search)
    XCTAssertLessThan(Date().timeIntervalSince(started), 6)
    XCTAssertEqual(result.matches.count, 300_000)
  }

  // A scan cut into budgeted calls resumes where each call stopped and finds exactly what one call finds.
  func testABudgetedScanFindsWhatOneCallFinds() throws {
    let text = (0..<6000).map { "w\($0) 😀x\($0 % 7)" }.joined(separator: "\n")
    let (snapshot, search) = try compiled(text, SearchQuery(text: "\\w+\\d|😀", regex: true))
    func scan(_ budget: UInt32) -> (matches: [Int32], calls: Int) {
      var scan = cp_search_scan(next: 0, limited: 0, budget_ms: budget)
      var buffer = [Int32](repeating: 0, count: 1 << 20)
      var matches: [Int32] = []
      var calls = 0
      while scan.next >= 0 {
        let n = Int(cp_search_find(search.pointer, snapshot.pointer, &scan, &buffer, UInt32(buffer.count)))
        matches += buffer[0..<n]
        calls += 1
      }
      return (matches, calls)
    }
    let whole = scan(0)
    let cut = scan(1)
    XCTAssertEqual(whole.calls, 1)
    XCTAssertGreaterThan(cut.calls, 1, "the budget never stopped a call")
    XCTAssertEqual(cut.matches, whole.matches)
  }

  // A call stops once its budget is spent and says where the next call resumes.
  func testACallStopsAtItsBudget() throws {
    let lines = Array(repeating: String(repeating: "a", count: 18) + "b", count: 40).joined(separator: "\n")
    let (text, search) = try compiled(lines, SearchQuery(text: "(a+)+$", regex: true))
    var scan = cp_search_scan(next: 0, limited: 0, budget_ms: 1)
    var buffer = [Int32](repeating: 0, count: 64)
    let n = cp_search_find(search.pointer, text.pointer, &scan, &buffer, UInt32(buffer.count))
    XCTAssertEqual(n, 0)
    XCTAssertGreaterThan(scan.next, 0)
    XCTAssertLessThan(Int(scan.next), lines.utf16.count)
    XCTAssertEqual(scan.limited, 0)
  }
}
