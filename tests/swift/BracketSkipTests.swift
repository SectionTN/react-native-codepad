import XCTest

@testable import Codepad

final class BracketSkipTests: XCTestCase {
  private final class CountingHighlighter: Highlighter {
    var calls = 0

    override func spans(snapshot: Snapshot, doc: Document, firstLine: Int, lastLine: Int) -> [[Int]] {
      calls += 1
      return super.spans(snapshot: snapshot, doc: doc, firstLine: firstLine, lastLine: lastLine)
    }
  }

  private func pairAt(_ text: String, _ caret: Int) -> [Int]? {
    let lang = HostLanguages.javascript()
    let (snapshot, doc) = parseSnapshot(lang, text)
    let window = SpanWindow(snapshot: snapshot, highlighter: Highlighter(language: lang), doc: doc)
    return BracketMatcher.match(doc, caret: caret, skip: { window.skip($0) }).map { [$0.0, $0.1] }
  }

  func testBracketsInsideStringsAndCommentsAreSkipped() {
    XCTAssertEqual(pairAt("a = (\"(\" + b) // )", 4), [4, 12])
    XCTAssertEqual(pairAt("f( // )\n)", 1), [1, 8])
  }

  func testPairIsCachedUntilTheCaretMoves() {
    let lang = HostLanguages.javascript()
    let core = EditorCore("(a)")
    let (snapshot, _) = parseSnapshot(lang, core.document.text())
    let highlighter = CountingHighlighter(language: lang)
    let highlight = BracketHighlight(core: core)
    let first = highlight.pair(snapshot: snapshot, highlighter: highlighter)
    XCTAssertEqual(first.map { [$0.0, $0.1] }, [0, 2])
    XCTAssertEqual(highlighter.calls, 1)
    _ = highlight.pair(snapshot: snapshot, highlighter: highlighter)
    XCTAssertEqual(highlighter.calls, 1)
    core.setSelection(anchor: 1, head: 1)
    XCTAssertEqual(highlight.pair(snapshot: snapshot, highlighter: highlighter).map { [$0.0, $0.1] }, [0, 2])
    XCTAssertEqual(highlighter.calls, 2)
    highlight.enabled = false
    XCTAssertNil(highlight.pair(snapshot: snapshot, highlighter: highlighter))
    XCTAssertEqual(highlighter.calls, 2)
  }
}
