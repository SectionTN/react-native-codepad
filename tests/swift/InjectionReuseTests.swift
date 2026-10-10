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

  func testHtmlReusesInjectedTreesAcrossEdits() throws {
    let text = "<script>let a = 1;</script>\n<style>.a { color: red; }</style>\n<p>x</p>"
    let core = EditorCore(text)
    let engine = engine()
    wire(core, engine)
    engine.setLanguage("html")
    engine.setText(text, revision: 0)
    let first = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(first.stats.freshInjections, 2)
    XCTAssertEqual(first.stats.reusedInjections, 0)

    let x = Array(text.utf16).firstIndex(of: u16("x"))!
    core.replace(x, x + 1, "xy")
    let second = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(second.stats.freshInjections, 0)
    XCTAssertEqual(second.stats.reusedInjections, 2)

    let one = (text as NSString).range(of: "1;").location
    core.replace(one, one + 1, "12")
    let third = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(third.stats.freshInjections, 0)
    XCTAssertEqual(third.stats.reusedInjections, 2)
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
    XCTAssertEqual(second.stats.reusedInjections, fresh)

    engine.setLanguage("markdown")
    let third = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(third.stats.reusedInjections, 0)
    XCTAssertEqual(third.stats.freshInjections, fresh)
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
