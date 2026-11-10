import Foundation
import XCTest

@testable import Codepad

final class HighlighterTests: XCTestCase {
  // The injection is built by hand so its extent is exact: the javascript tree covers "\nlet x = 1;\n" on lines 2 to 4.
  func testInjectionsOnThePaintedEdgeAreStyled() throws {
    let html = HostLanguages.load("html", "html")
    let js = HostLanguages.javascript()
    let text = "<p>a</p>\n<p>b</p>\n<script>\nlet x = 1;\n</script>\n<p>c</p>"
    let (snapshot, doc) = parseSnapshot(html, text)
    XCTAssertEqual(snapshot.injected.map { $0.language.id }, [js.id])
    XCTAssertEqual(snapshot.injected.first?.start, (text as NSString).range(of: "\nlet").location)
    let hl = Highlighter(language: html)
    XCTAssertEqual(styleAt(hl.spans(snapshot: snapshot, doc: doc, firstLine: 3, lastLine: 3)[0], 0), "keyword")
    XCTAssertEqual(styleAt(hl.spans(snapshot: snapshot, doc: doc, firstLine: 2, lastLine: 3)[1], 0), "keyword")
    XCTAssertEqual(styleAt(hl.spans(snapshot: snapshot, doc: doc, firstLine: 3, lastLine: 4)[0], 0), "keyword")
    XCTAssertEqual(hl.spans(snapshot: snapshot, doc: doc, firstLine: 0, lastLine: 1).count, 2)
  }

  func testCapturesMapToStylesPerLine() {
    let lang = HostLanguages.javascript()
    let (snapshot, doc) = parseSnapshot(lang, "const x = 1; // hi\nreturn \"s\";")
    let spans = Highlighter(language: lang).spans(snapshot: snapshot, doc: doc, firstLine: 0, lastLine: 1)
    XCTAssertEqual(spans.count, 2)
    XCTAssertEqual(styleAt(spans[0], 0)?.split(separator: ".").first.map(String.init), "keyword")
    XCTAssertEqual(styleAt(spans[0], 10), "number")
    XCTAssertEqual(styleAt(spans[0], 14), "comment")
    XCTAssertEqual(styleAt(spans[1], 0), "keyword.return")
    XCTAssertEqual(styleAt(spans[1], 8), "string")
  }

  func testPredicatesFilterMatches() {
    let lang = HostLanguages.javascript()
    let (snapshot, doc) = parseSnapshot(lang, "let FOO = BAR_1 + bar;")
    let spans = Highlighter(language: lang).spans(snapshot: snapshot, doc: doc, firstLine: 0, lastLine: 0)
    XCTAssertEqual(styleAt(spans[0], 4), "constant")
    XCTAssertEqual(styleAt(spans[0], 10), "constant")
    XCTAssertEqual(styleAt(spans[0], 18), "variable")
  }

  func testMultiLineCapturesAreClippedPerLine() {
    let lang = HostLanguages.javascript()
    let (snapshot, doc) = parseSnapshot(lang, "/* a\nb */ x")
    let spans = Highlighter(language: lang).spans(snapshot: snapshot, doc: doc, firstLine: 0, lastLine: 1)
    XCTAssertEqual(styleAt(spans[0], 1), "comment")
    XCTAssertEqual(styleAt(spans[1], 0), "comment")
    XCTAssertEqual(styleAt(spans[1], 3), "comment")
    XCTAssertNil(styleAt(spans[1], 4))
    XCTAssertEqual(styleAt(spans[1], 5), "variable")
  }

  func testConcealCapturesNeverPaint() {
    _ = HostLanguages.javascript()
    LanguageRegistry.register(
      HostProvider(id: "javascript_conceal", pointer: HostGrammars.language(named: "javascript")!, highlights: "(comment) @conceal\n(number) @number", injections: ""))
    guard let lang = LanguageRegistry.resolve("javascript_conceal") else { return XCTFail("javascript_conceal did not load") }
    let (snapshot, doc) = parseSnapshot(lang, "1 // hi")
    let spans = Highlighter(language: lang).spans(snapshot: snapshot, doc: doc, firstLine: 0, lastLine: 0)
    XCTAssertEqual(styleAt(spans[0], 0), "number")
    XCTAssertNil(styleAt(spans[0], 3))
  }
}
