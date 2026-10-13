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

  // The blocker runs between two budget slices of the first parse, so the edit lands while a parse is outstanding.
  func testAnEditBetweenBudgetSlicesRestartsTheParse() throws {
    let base = String(repeating: "let a = 1;\n", count: 2000)
    let core = EditorCore(base)
    let q = snapshots
    let engine = SyntaxEngine(postToMain: { $0() }, onSnapshot: { q.add($0) }, budgetMicros: 1)
    wire(core, engine)
    engine.setLanguage("javascript")
    engine.setText(base, revision: core.document.revision)
    let started = DispatchSemaphore(value: 0)
    let release = DispatchSemaphore(value: 0)
    engine.queue.async {
      started.signal()
      release.wait()
    }
    started.wait()
    core.replace(0, 0, " ")
    release.signal()
    let snapshot = try XCTUnwrap(snapshots.takeRevision(1))
    XCTAssertEqual(shape(try freshTree(" " + base)), shape(snapshot.tree))
    engine.close()
  }

  private func freshTree(_ text: String) throws -> Tree {
    let lang = try XCTUnwrap(LanguageRegistry.resolve("javascript"))
    let mirror = Mirror()
    mirror.setText(text)
    let parser = Parser()
    parser.setLanguage(lang.pointer)
    return try XCTUnwrap(parser.parse(nil, mirror, nil, budgetMicros: 0))
  }

  private func shape(_ tree: Tree) -> [String] {
    var out: [String] = []
    func walk(_ n: Node) {
      out.append("\(n.type) \(n.startUnit) \(n.endUnit)")
      for i in 0..<n.childCount { walk(n.child(i)) }
    }
    walk(tree.rootNode)
    return out
  }

  func testOffsetDirectiveTrimsTheTemplateStringDelimiters() throws {
    HostLanguages.load("html", "html")
    // The regex literal targets a never-injected language and must leave the pass and the html injection intact.
    let text = "html`<b>x</b>`; /ab+/"
    let engine = engine()
    engine.setLanguage("javascript")
    engine.setText(text, revision: 1)
    let snapshot = try XCTUnwrap(snapshots.takeRevision(1))
    XCTAssertEqual(snapshot.tree.rootNode.type, "program")
    XCTAssertEqual(snapshot.injected.count, 1)
    XCTAssertEqual(snapshot.injected.first?.language.id, "html")
    XCTAssertEqual(snapshot.injected.first?.start, 5)
    XCTAssertEqual(snapshot.injected.first?.end, 13)
    engine.setText("html``", revision: 2)
    let empty = try XCTUnwrap(snapshots.takeRevision(2))
    XCTAssertEqual(empty.injected.count, 0, "an empty template string injects nothing")
    engine.close()
  }

  func testSnapshotsCarryTheirLanguage() throws {
    HostLanguages.load("html", "html")
    let engine = engine()
    engine.setLanguage("javascript")
    engine.setText("let a = 1;", revision: 1)
    let snapshot = try XCTUnwrap(snapshots.takeRevision(1))
    XCTAssertEqual(snapshot.languageId, "javascript")
    engine.setLanguage("html")
    let switched = try XCTUnwrap(snapshots.take())
    XCTAssertEqual(switched.languageId, "html")
    engine.close()
  }

  // A region list that spans the file, or one that misses the edited line, would re-query the page or paint it stale.
  func testAnEditInsideAFunctionLeavesTheNextStatementUntouched() throws {
    let text = "function f() {\n  return 1;\n}\nlet g = 2;\n"
    let core = EditorCore(text)
    let engine = engine()
    wire(core, engine)
    engine.setLanguage("javascript")
    engine.setText(text, revision: 0)
    let first = try XCTUnwrap(snapshots.takeRevision(0))
    XCTAssertEqual(first.basedOn, -1)
    core.replace(25, 25, "2")
    let second = try XCTUnwrap(snapshots.takeRevision(1))
    XCTAssertEqual(second.basedOn, 0)
    XCTAssertTrue(meetsLine(second.changed, 15, 26))
    XCTAssertFalse(meetsLine(second.changed, 29, 39))
    engine.close()
  }

  // The declarator's name keeps the function style unless the snapshot names its line.
  func testAChangedValueKindCoversTheDeclaratorName() throws {
    let core = EditorCore("const f =\n  function() {};\n")
    let engine = engine()
    wire(core, engine)
    engine.setLanguage("javascript")
    engine.setText(core.document.text(), revision: 0)
    _ = try XCTUnwrap(snapshots.takeRevision(0))
    core.replace(12, 25, "1")
    let snapshot = try XCTUnwrap(snapshots.takeRevision(1))
    XCTAssertTrue(meetsLine(snapshot.changed, 0, 9))
    engine.close()
  }

  // The blocker holds the syntax queue while two edits queue, so one pass covers both.
  func testEditsBeforeAPassCompletesAccumulateTheirRegions() throws {
    let text = "let a = 1;\nlet b = 2;\nlet c = 3;\n"
    let core = EditorCore(text)
    let engine = engine()
    wire(core, engine)
    engine.setLanguage("javascript")
    engine.setText(text, revision: 0)
    _ = try XCTUnwrap(snapshots.takeRevision(0))
    let started = DispatchSemaphore(value: 0)
    let release = DispatchSemaphore(value: 0)
    engine.queue.async {
      started.signal()
      release.wait()
    }
    started.wait()
    core.replace(8, 9, "9")
    core.replace(30, 31, "9")
    release.signal()
    let snapshot = try XCTUnwrap(snapshots.takeRevision(2))
    XCTAssertEqual(snapshot.basedOn, 0)
    XCTAssertTrue(meetsLine(snapshot.changed, 0, 10))
    XCTAssertTrue(meetsLine(snapshot.changed, 22, 32))
    XCTAssertFalse(meetsLine(snapshot.changed, 11, 21))
    engine.close()
  }

  // The reference tree used to live in the injection pass; a language without one published no regions at all.
  func testALanguageWithoutInjectionsStillReportsRegions() throws {
    HostLanguages.load("json", "json")
    let core = EditorCore("{\"a\": 1,\n \"b\": 2}\n")
    let engine = engine()
    wire(core, engine)
    engine.setLanguage("json")
    engine.setText(core.document.text(), revision: 0)
    _ = try XCTUnwrap(snapshots.takeRevision(0))
    core.replace(15, 16, "3")
    let snapshot = try XCTUnwrap(snapshots.takeRevision(1))
    XCTAssertEqual(snapshot.basedOn, 0)
    XCTAssertTrue(meetsLine(snapshot.changed, 9, 17))
    engine.close()
  }
}
