import XCTest

@testable import Codepad

final class HighlighterTests: XCTestCase {
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

  func testUnknownLanguageResolvesToNil() {
    _ = HostLanguages.javascript()
    XCTAssertNil(LanguageRegistry.resolve("no_such_language"))
    XCTAssertNil(LanguageRegistry.resolveInjection("c_sharp"))
    XCTAssertTrue(LanguageRegistry.resolveInjection("js") === LanguageRegistry.resolve("javascript"))
  }

  func testConcealCapturesNeverPaint() {
    let base = HostLanguages.javascript()
    LanguageRegistry.register(
      HostProvider(id: "javascript_conceal", pointer: base.pointer, highlights: "(comment) @conceal\n(number) @number", injections: ""))
    guard let lang = LanguageRegistry.resolve("javascript_conceal") else { return XCTFail("javascript_conceal did not load") }
    let (snapshot, doc) = parseSnapshot(lang, "1 // hi")
    let spans = Highlighter(language: lang).spans(snapshot: snapshot, doc: doc, firstLine: 0, lastLine: 0)
    XCTAssertEqual(styleAt(spans[0], 0), "number")
    XCTAssertNil(styleAt(spans[0], 3))
  }
}
