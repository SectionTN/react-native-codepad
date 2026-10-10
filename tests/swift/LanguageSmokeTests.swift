import Foundation
import XCTest

@testable import Codepad

final class LanguageSmokeTests: XCTestCase {
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

  func testEveryPackageCompilesItsQueriesAndHighlightsASnippet() throws {
    let packages = HostLanguages.packages()
    XCTAssertEqual(packages.count, 16)
    for (id, grammar) in packages { HostLanguages.load(id, grammar) }
    for (_, grammar) in packages {
      let lang = try XCTUnwrap(LanguageRegistry.resolve(grammar), "\(grammar) did not load")
      let text = try XCTUnwrap(snippets[grammar], "no snippet for \(grammar)")
      let core = EditorCore(text)
      let snapshots = SnapshotQueue()
      let engine = SyntaxEngine(postToMain: { $0() }, onSnapshot: { snapshots.add($0) })
      engine.setLanguage(grammar)
      engine.setText(text, revision: 1)
      let snapshot = try XCTUnwrap(snapshots.takeRevision(1, 10), "\(grammar) never parsed")
      let spans = Highlighter(language: lang).spans(snapshot: snapshot, doc: core.document, firstLine: 0, lastLine: 0)
      XCTAssertFalse(spans[0].isEmpty, "\(grammar) paints line 0")
      if grammar == "markdown" { XCTAssertGreaterThanOrEqual(snapshot.injected.count, 2, "markdown injects inline and the fence") }
      engine.close()
    }
    print("LanguageSmokeTests: \(packages.count) grammars")
  }
}
