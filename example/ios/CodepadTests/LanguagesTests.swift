import XCTest

@testable import Codepad

@MainActor
final class LanguagesTests: XCTestCase {
  // One line per grammar; every line paints at least one span through highlights.scm.
  private let snippets: [String: String] = [
    "javascript": "const x = 1; // hi", "typescript": "const x: number = 1;",
    "tsx": "const a = <div className=\"x\">{1}</div>;", "json": "{\"a\": [1, true, null]}",
    "html": "<p class=\"x\">hi</p>", "css": ".a { color: red; }",
    "markdown": "# Title\n\nSome *text*\n\n```js\nlet a = 1;\n```\n", "markdown_inline": "Some *text* and `code`",
    "python": "def f(x):\n    return x + 1", "java": "class A { int x = 1; }",
    "kotlin": "fun main() { val x = 1 }", "swift": "let x = 1 // hi",
    "c": "int main(void) { return 0; }", "rust": "fn main() { let x = 1; }",
    "go": "package main\nfunc main() { x := 1 }", "yaml": "a: 1\nb: [x, y]",
  ]

  func testLinkedLanguagesLoadAndParse() {
    // The production class scan behind getAvailableLanguages finds every linked package.
    let ids = LanguageScan.providerIds()
    XCTAssertEqual(
      ids,
      [
        "c", "css", "go", "html", "java", "javascript", "json", "kotlin", "markdown", "markdown_inline", "python", "rust",
        "swift", "tsx", "typescript", "yaml",
      ])
    for id in ids {
      guard let language = LanguageRegistry.resolve(id) else {
        XCTFail("\(id) did not load")
        continue
      }
      XCTAssertGreaterThan(language.highlights.query.patternCount, 0, "\(id) highlights")
      guard let text = snippets[id] else {
        XCTFail("no snippet for \(id)")
        continue
      }
      let parser = Parser()
      XCTAssertTrue(parser.setLanguage(language.pointer), "\(id) language")
      let mirror = Mirror()
      mirror.setText(text)
      guard let tree = parser.parse(nil, mirror, nil, budgetMicros: 0) else {
        XCTFail("\(id) parse")
        continue
      }
      let snapshot = Snapshot(revision: 0, tree: tree, injected: [], languageId: id)
      let spans = Highlighter(language: language).spans(snapshot: snapshot, doc: Document(text), firstLine: 0, lastLine: 0)
      XCTAssertFalse(spans[0].isEmpty, "\(id) paints line 0")
    }
  }
}
