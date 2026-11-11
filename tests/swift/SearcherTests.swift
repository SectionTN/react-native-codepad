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
}
