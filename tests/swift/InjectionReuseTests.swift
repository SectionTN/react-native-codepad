import Foundation
import XCTest

@testable import Codepad

final class InjectionReuseTests: XCTestCase {
  private let snapshots = SnapshotQueue()

  /// A provider whose language pointer blocks until the test lets it through, so an edit lands mid pass.
  private final class SlowProvider: NSObject, CPLanguageProvider {
    let reached = DispatchSemaphore(value: 0)
    let gate = DispatchSemaphore(value: 0)
    let id = "slow"
    let highlights = ""
    let injections = ""

    var languagePointer: UnsafeRawPointer {
      reached.signal()
      _ = gate.wait(timeout: .now() + 5)
      return UnsafeRawPointer(HostGrammars.javascript())
    }
  }

  override func setUp() {
    super.setUp()
    for (id, grammar) in [("javascript", "javascript"), ("css", "css"), ("html", "html"), ("markdown", "markdown"), ("markdown", "markdown_inline")] {
      HostLanguages.load(id, grammar)
    }
  }

  private func engine() -> SyntaxEngine {
    let q = snapshots
    return SyntaxEngine(postToMain: { $0() }, onSnapshot: { q.add($0) })
  }

  private func wire(_ core: EditorCore, _ engine: SyntaxEngine) {
    core.onChange = { change, _ in engine.edit(change, points: SyntaxEngine.pointsFor(doc: core.document, change: change)) }
  }

  private func start(_ language: String, _ text: String) -> (EditorCore, SyntaxEngine) {
    let core = EditorCore(text)
    let engine = engine()
    wire(core, engine)
    engine.setLanguage(language)
    engine.setText(text, revision: 0)
    return (core, engine)
  }

  private func offset(_ text: String, _ needle: String, last: Bool = false) -> Int {
    (text as NSString).range(of: needle, options: last ? .backwards : []).location
  }

  func testEditsOutsideInjectionsCarryTheirTrees() throws {
    let text = "<script>let a = 1;</script>\n<style>.a { color: red; }</style>\n<p>x</p>"
    let (core, engine) = start("html", text)
    let first = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(first.stats.freshInjections, 2)
    XCTAssertEqual(first.stats.reusedInjections, 0)
    XCTAssertEqual(first.stats.carriedInjections, 0)

    let x = Array(text.utf16).firstIndex(of: u16("x"))!
    core.replace(x, x + 1, "xy")
    let second = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(second.stats.freshInjections, 0)
    XCTAssertEqual(second.stats.reusedInjections, 0)
    XCTAssertEqual(second.stats.carriedInjections, 2)

    let one = (text as NSString).range(of: "1;").location
    core.replace(one, one + 1, "12")
    let third = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(third.stats.freshInjections, 0)
    XCTAssertEqual(third.stats.reusedInjections, 1)
    XCTAssertEqual(third.stats.carriedInjections, 1)
    let html = try XCTUnwrap(LanguageRegistry.resolve("html"))
    let spans = Highlighter(language: html).spans(snapshot: third, doc: core.document, firstLine: 0, lastLine: 1)
    XCTAssertEqual(styleAt(spans[0], 8), "keyword")
    XCTAssertEqual(styleAt(spans[1], 12), "property")
    engine.close()
  }

  func testMarkdownParagraphsReuseTheirTreesAndUnknownFencesInjectNothing() throws {
    let text = "# T\n\nfirst para\n\nsecond para\n\n```JS\nlet a = 1;\n```\n\n```ruby\nputs 1\n```\n"
    let core = EditorCore(text)
    let engine = engine()
    wire(core, engine)
    engine.setLanguage("markdown")
    engine.setText(text, revision: 0)
    let first = try XCTUnwrap(snapshots.takeParsed())
    let fresh = first.stats.freshInjections
    XCTAssertGreaterThanOrEqual(fresh, 3, "inline nodes and the js fence")
    XCTAssertTrue(first.injected.contains { $0.language.id == "javascript" })
    XCTAssertFalse(first.injected.contains { $0.language.id == "ruby" })
    let markdown = try XCTUnwrap(LanguageRegistry.resolve("markdown"))
    XCTAssertFalse(Highlighter(language: markdown).spans(snapshot: first, doc: core.document, firstLine: 0, lastLine: 0)[0].isEmpty)

    let after = (text as NSString).range(of: "second para").location + 11
    core.replace(after, after, "!")
    let second = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(second.stats.freshInjections, 0)
    XCTAssertEqual(second.stats.reusedInjections, 1)
    XCTAssertEqual(second.stats.carriedInjections, fresh - 1)

    engine.setLanguage("markdown")
    let third = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(third.stats.reusedInjections, 0)
    XCTAssertEqual(third.stats.carriedInjections, 0)
    XCTAssertEqual(third.stats.freshInjections, fresh)
    engine.close()
  }

  func testChangingTheFenceLanguageRetiresTheOldTree() throws {
    let text = "# T\n\nfirst para\n\n```js\nlet a = 1;\n```\n"
    let (core, engine) = start("markdown", text)
    let first = try XCTUnwrap(snapshots.takeParsed())
    let count = first.injected.count
    XCTAssertTrue(first.injected.contains { $0.language.id == "javascript" })
    let at = offset(text, "```js") + 3
    core.replace(at, at + 2, "css")
    let second = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(second.injected.count, count)
    XCTAssertFalse(second.injected.contains { $0.language.id == "javascript" })
    XCTAssertEqual(second.injected.first { $0.language.id == "css" }?.start, offset(text, "let") + 1)
    XCTAssertEqual(second.stats.freshInjections, 1)
    XCTAssertEqual(second.stats.reusedInjections, 0)
    XCTAssertEqual(second.stats.carriedInjections, count - 1)
    engine.close()
  }

  func testRemovingTheClosingFenceExtendsTheInjection() throws {
    let text = "# T\n\n```js\nlet a = 1;\n```\n\nafter para\n"
    let (core, engine) = start("markdown", text)
    let first = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(first.injected.count, 3)
    let close = offset(text, "```", last: true)
    core.replace(close, close + 4, "")
    let second = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(second.injected.count, 2)
    let js = try XCTUnwrap(second.injected.first { $0.language.id == "javascript" })
    XCTAssertGreaterThan(js.end, offset(core.document.text(), "after"))
    XCTAssertEqual(second.stats.freshInjections + second.stats.reusedInjections, 1)
    XCTAssertEqual(second.stats.carriedInjections, 1)
    engine.close()
  }

  func testPastedFencesAppear() throws {
    let text = "# T\n\nfirst para\n\nsecond para\n"
    let (core, engine) = start("markdown", text)
    let first = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(first.injected.count, 3)
    let length = text.utf16.count
    core.replace(length, length, "\n```js\nlet a = 1;\n```\n\n```css\n.a {}\n```\n")
    let second = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(second.injected.count, 5)
    XCTAssertEqual(second.stats.freshInjections, 2)
    XCTAssertLessThanOrEqual(second.stats.reusedInjections, 1)
    XCTAssertGreaterThanOrEqual(second.stats.carriedInjections, 2)
    engine.close()
  }

  func testDeletingAFenceRetiresItsTree() throws {
    let text = "# T\n\n```js\nlet a = 1;\n```\n\nafter para\n"
    let (core, engine) = start("markdown", text)
    let first = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(first.injected.count, 3)
    core.replace(offset(text, "```js"), offset(text, "after"), "")
    let second = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(second.injected.count, 2)
    XCTAssertFalse(second.injected.contains { $0.language.id == "javascript" })
    XCTAssertEqual(second.stats.freshInjections, 0)
    XCTAssertLessThanOrEqual(second.stats.reusedInjections, 1)
    XCTAssertGreaterThanOrEqual(second.stats.carriedInjections, 1)
    engine.close()
  }

  func testABurstInsideAFenceKeepsOneTree() throws {
    let text = "# T\n\n```js\nlet a = 1;\n```\n\nafter para\n"
    let (core, engine) = start("markdown", text)
    let first = try XCTUnwrap(snapshots.takeParsed())
    let end0 = try XCTUnwrap(first.injected.first { $0.language.id == "javascript" }).end
    let at = offset(text, "1;")
    for i in 0..<20 { core.replace(at + i, at + i, "x") }
    let last = try XCTUnwrap(snapshots.takeRevision(core.document.revision, 10))
    XCTAssertEqual(last.injected.count, 3)
    XCTAssertEqual(last.injected.first { $0.language.id == "javascript" }?.end, end0 + 20)
    engine.close()
  }

  // The slow fence is inserted after the first pass, so pass two is the first to resolve it and blocks there.
  func testACancelledPassDoesNotAdvanceTheReferenceTree() throws {
    let slow = SlowProvider()
    LanguageRegistry.register(slow)
    let code = (0..<200).map { "function f\($0)(a, b) { return a + b * \($0); }" }.joined(separator: "\n")
    let text = "# T\n\n```javascript\nlet b = 1;\n```\n"
    let (core, engine) = start("markdown", text)
    let first = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(first.injected.count, 2)
    core.replace(5, 5, "```slow\n\(code)\n```\n\n")
    XCTAssertEqual(slow.reached.wait(timeout: .now() + 5), .success)
    let one = offset(core.document.text(), "let b = 1;") + 8
    core.replace(one, one + 1, "2")
    slow.gate.signal()
    let snapshot = try XCTUnwrap(snapshots.takeRevision(2))
    XCTAssertTrue(snapshot.injected.contains { $0.language.id == "slow" })
    XCTAssertEqual(snapshot.stats.freshInjections, 1)
    XCTAssertEqual(snapshot.stats.reusedInjections, 1)
    engine.close()
  }

  // A key during the injection pass cancels it; the snapshot it was building must not go out half filled.
  func testCancelledInjectionPassPublishesNoPartialSnapshot() throws {
    let slow = SlowProvider()
    LanguageRegistry.register(slow)
    // The fence is long enough for the parser to reach a cancellation check once the edit lands.
    let code = (0..<200).map { "function f\($0)(a, b) { return a + b * \($0); }" }.joined(separator: "\n")
    let text = "# T\n\nfirst para\n\nsecond para\n\n```slow\n\(code)\n```\n"
    let core = EditorCore(text)
    let engine = engine()
    wire(core, engine)
    engine.setLanguage("markdown")
    engine.setText(text, revision: 0)
    XCTAssertEqual(slow.reached.wait(timeout: .now() + 5), .success)
    let second = (text as NSString).range(of: "second").location
    core.replace(second, second, "the ")
    slow.gate.signal()
    let snapshot = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(snapshot.injected.count, 4)
    engine.close()
  }
}
