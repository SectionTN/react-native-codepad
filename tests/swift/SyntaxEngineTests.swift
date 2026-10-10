import Foundation
import XCTest

@testable import Codepad

final class SyntaxEngineTests: XCTestCase {
  private let snapshots = SnapshotQueue()

  override func setUp() {
    super.setUp()
    _ = HostLanguages.javascript()
  }

  private func engine() -> SyntaxEngine {
    let q = snapshots
    return SyntaxEngine(postToMain: { $0() }, onSnapshot: { q.add($0) })
  }

  private func wire(_ core: EditorCore, _ engine: SyntaxEngine) {
    core.onChange = { change, _ in engine.edit(change, points: SyntaxEngine.pointsFor(doc: core.document, change: change)) }
  }

  func testPublishesSnapshotsForTextAndEdits() throws {
    let core = EditorCore("let a = 1;")
    let engine = engine()
    wire(core, engine)
    engine.setLanguage("javascript")
    engine.setText(core.document.text(), revision: core.document.revision)
    let first = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(first.revision, 0)
    let lang = try XCTUnwrap(LanguageRegistry.resolve("javascript"))
    let spans = Highlighter(language: lang).spans(snapshot: first, doc: core.document, firstLine: 0, lastLine: 0)
    XCTAssertFalse(spans[0].isEmpty)
    core.replace(4, 5, "value")
    let second = try XCTUnwrap(snapshots.take())
    XCTAssertEqual(second.revision, 1)
    XCTAssertEqual(second.tree.rootNode.endUnit, 14)
    engine.close()
  }

  func testBurstsOfEditsCoalesceIntoTheLatestRevision() throws {
    let core = EditorCore("")
    let engine = engine()
    wire(core, engine)
    engine.setLanguage("javascript")
    engine.setText("", revision: 0)
    _ = try XCTUnwrap(snapshots.take())
    for _ in 0..<200 { core.typeText("x") }
    var last: Snapshot?
    while let s = snapshots.take(2) {
      last = s
      if s.revision == 200 { break }
    }
    XCTAssertEqual(last?.revision, 200)
    engine.close()
  }

  func testInjectionsParseEmbeddedLanguages() throws {
    let core = EditorCore("const q = /ab+/; const s = `x`;")
    let engine = engine()
    engine.setLanguage("javascript")
    engine.setText(core.document.text(), revision: 0)
    // regex and template injections target languages that are not installed, so nothing is injected,
    // but the pass must complete and leave the host tree intact.
    let snapshot = try XCTUnwrap(snapshots.take())
    XCTAssertEqual(snapshot.injected.count, 0)
    XCTAssertEqual(snapshot.tree.rootNode.type, "program")
    engine.close()
  }

  func testOffsetDirectiveTrimsTheTemplateStringDelimiters() throws {
    HostLanguages.load("html", "html")
    let text = "html`<b>x</b>`"
    let engine = engine()
    engine.setLanguage("javascript")
    engine.setText(text, revision: 1)
    let snapshot = try XCTUnwrap(snapshots.takeRevision(1))
    XCTAssertEqual(snapshot.injected.count, 1)
    XCTAssertEqual(snapshot.injected.first?.language.id, "html")
    XCTAssertEqual(snapshot.injected.first?.ranges[0], 5)
    XCTAssertEqual(snapshot.injected.first?.ranges[1], text.utf16.count - 1)
    engine.close()
  }

  func testEmptyTemplateStringInjectsNothing() throws {
    HostLanguages.load("html", "html")
    let engine = engine()
    engine.setLanguage("javascript")
    engine.setText("html``", revision: 1)
    let snapshot = try XCTUnwrap(snapshots.takeRevision(1))
    XCTAssertEqual(snapshot.injected.count, 0)
    engine.close()
  }

  func testSnapshotsCarryTheirLanguage() throws {
    let engine = engine()
    engine.setLanguage("javascript")
    engine.setText("let a = 1;", revision: 1)
    let snapshot = try XCTUnwrap(snapshots.takeRevision(1))
    XCTAssertEqual(snapshot.languageId, "javascript")
    engine.close()
  }
}
