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
    "kv_lite": "name = \"x\" # hi",
    "php": "<p><?php echo $name; ?></p>", "php_only": "function f($x) { return $x + 1; }",
    "sql": "SELECT id FROM users WHERE id = 1; -- hi",
    "xml": "<svg width=\"1\"><style>.a { color: red; }</style></svg>", "dtd": "<!ELEMENT note (to, from)>\n",
    "ini": "[core]\nname = x\n; hi\n",
  ]

  func testLinkedLanguagesLoadAndParse() {
    // The production class scan behind getAvailableLanguages finds every linked package.
    let ids = LanguageScan.providerIds()
    XCTAssertEqual(
      ids,
      [
        "c", "css", "dtd", "go", "html", "ini", "java", "javascript", "json", "kotlin", "kv_lite", "markdown",
        "markdown_inline", "php", "php_only", "python", "rust", "sql", "swift", "tsx", "typescript", "xml", "yaml",
      ])
    for id in ids {
      guard let language = LanguageRegistry.resolve(id) else {
        XCTFail("\(id) did not load")
        continue
      }
      guard let text = snippets[id] else {
        XCTFail("no snippet for \(id)")
        continue
      }
      let box = ParseBox(length: text.utf16.count)
      let engine = SyntaxEngine(postToMain: { $0() }, onSnapshot: { box.offer($0) })
      engine.setLanguage(id)
      engine.setText(text, revision: 0)
      guard box.ready.wait(timeout: .now() + 10) == .success, let snapshot = box.snapshot else {
        XCTFail("\(id) parse")
        engine.close()
        continue
      }
      let spans = Highlighter(language: language).spans(snapshot: snapshot, doc: Document(text), firstLine: 0, lastLine: 0)
      XCTAssertFalse(spans[0].isEmpty, "\(id) paints line 0")
      engine.close()
    }
  }
}

/// Keeps the first snapshot of the whole text, the one setText produced.
private final class ParseBox: @unchecked Sendable {
  let length: Int
  let ready = DispatchSemaphore(value: 0)
  private let lock = NSLock()
  private(set) var snapshot: Snapshot?

  init(length: Int) { self.length = length }

  func offer(_ s: Snapshot) {
    let first = lock.withLock {
      guard snapshot == nil, s.length == length else { return false }
      snapshot = s
      return true
    }
    if first { ready.signal() }
  }
}
