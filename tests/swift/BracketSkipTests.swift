import XCTest

@testable import Codepad

final class BracketSkipTests: XCTestCase {
  private func pairAt(_ text: String, _ caret: Int) -> [Int]? {
    let (snapshot, doc) = parseSnapshot(HostLanguages.javascript(), text)
    return BracketMatcher.match(doc, caret: caret, snapshot: snapshot).map { [$0.0, $0.1] }
  }

  func testBracketsInsideStringsAndCommentsAreSkipped() {
    XCTAssertEqual(pairAt("a = (\"(\" + b) // )", 4), [4, 12])
    XCTAssertEqual(pairAt("f( // )\n)", 1), [1, 8])
  }

  func testPairIsCachedUntilTheCaretMoves() {
    let core = EditorCore("(a)")
    let (snapshot, _) = parseSnapshot(HostLanguages.javascript(), core.document.text())
    var calls = 0
    let highlight = BracketHighlight(core: core) { snapshot in
      calls += 1
      return core.bracketMatch(snapshot: snapshot)
    }
    XCTAssertEqual(highlight.pair(snapshot: snapshot).map { [$0.0, $0.1] }, [0, 2])
    XCTAssertEqual(calls, 1)
    _ = highlight.pair(snapshot: snapshot)
    XCTAssertEqual(calls, 1)
    core.setSelection(anchor: 1, head: 1)
    XCTAssertEqual(highlight.pair(snapshot: snapshot).map { [$0.0, $0.1] }, [0, 2])
    XCTAssertEqual(calls, 2)
    highlight.enabled = false
    XCTAssertNil(highlight.pair(snapshot: snapshot))
    XCTAssertEqual(calls, 2)
  }
}
