import CodepadCore
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

  private func treeString(_ snapshot: Snapshot) -> String {
    let length = cp_test_tree_string(snapshot.pointer, nil, 0)
    var buffer = [CChar](repeating: 0, count: Int(length) + 1)
    _ = cp_test_tree_string(snapshot.pointer, &buffer, UInt32(buffer.count))
    return String(decoding: buffer.prefix(Int(length)).map { UInt8(bitPattern: $0) }, as: UTF8.self)
  }

  func testPublishesSnapshotsForTextAndEdits() throws {
    let core = EditorCore("let a = 1;")
    let engine = engine()
    engine.setLanguage("javascript")
    engine.attach(core)
    let first = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(first.revision, 0)
    let lang = try XCTUnwrap(LanguageRegistry.resolve("javascript"))
    let spans = Highlighter(language: lang).spans(snapshot: first, doc: core.document, firstLine: 0, lastLine: 0)
    XCTAssertFalse(spans[0].isEmpty)
    core.replace(4, 5, "value")
    let second = try XCTUnwrap(snapshots.take())
    XCTAssertEqual(second.revision, 1)
    XCTAssertEqual(second.length, 14)
    engine.close()
  }

  // A view that gets its props and unmounts without entering a window never calls close.
  func testDroppingAnEngineWithoutCloseFreesItsCore() {
    final class Token: Sendable {}
    weak var token: Token?
    do {
      let held = Token()
      token = held
      let engine = SyntaxEngine(postToMain: { $0() }, onSnapshot: { _ in _ = held })
      engine.attach(EditorCore("let a = 1;"))
    }
    let deadline = Date().addingTimeInterval(5)
    while token != nil && Date() < deadline { Thread.sleep(forTimeInterval: 0.01) }
    XCTAssertNil(token)
  }

  func testBurstsOfEditsCoalesceIntoTheLatestRevision() throws {
    let core = EditorCore("")
    let engine = engine()
    engine.setLanguage("javascript")
    engine.attach(core)
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

  private struct Hold {
    let started = DispatchSemaphore(value: 0)
    let release = DispatchSemaphore(value: 0)
  }

  private func hold(_ engine: SyntaxEngine) -> Hold {
    let h = Hold()
    engine.queue.async {
      h.started.signal()
      h.release.wait()
    }
    return h
  }

  // Each round queues the next blocker behind its edit, so one budget slice and one edit run between two blockers.
  func testEditsBetweenEveryBudgetSliceStillPublish() throws {
    let base = String(repeating: "let a = 1;\n", count: 2000)
    let core = EditorCore(base)
    let q = snapshots
    let engine = SyntaxEngine(postToMain: { $0() }, onSnapshot: { q.add($0) }, budgetMicros: 1)
    engine.setLanguage("javascript")
    engine.attach(core)
    var current = hold(engine)
    current.started.wait()
    defer { current.release.signal() }
    var published: Snapshot?
    for _ in 1...20_000 {
      core.replace(0, 0, " ")
      let next = hold(engine)
      current.release.signal()
      current = next
      current.started.wait()
      while published == nil, let s = snapshots.take(0) {
        if s.revision > 0 { published = s }
      }
      if published != nil { break }
    }
    let snapshot = try XCTUnwrap(published, "no snapshot while an edit landed between every budget slice")
    // The incremental result paints exactly like a fresh parse of the same text.
    let lang = try XCTUnwrap(LanguageRegistry.resolve("javascript"))
    let (fresh, doc) = parseSnapshot(lang, String(repeating: " ", count: snapshot.revision) + base)
    XCTAssertEqual(snapshot.length, fresh.length)
    let tree = treeString(snapshot)
    XCTAssertTrue(tree.hasPrefix("(program"))
    XCTAssertEqual(tree, treeString(fresh))
    let hl = Highlighter(language: lang)
    XCTAssertEqual(
      hl.spans(snapshot: snapshot, doc: doc, firstLine: 0, lastLine: doc.lineCount - 1),
      hl.spans(snapshot: fresh, doc: doc, firstLine: 0, lastLine: doc.lineCount - 1))
    engine.close()
  }

  func testOffsetDirectiveTrimsTheTemplateStringDelimiters() throws {
    HostLanguages.load("html", "html")
    // The regex literal targets a never-injected language and must leave the pass and the html injection intact.
    let text = "html`<b>x</b>`; /ab+/"
    let core = EditorCore(text)
    let engine = engine()
    engine.setLanguage("javascript")
    engine.attach(core)
    let snapshot = try XCTUnwrap(snapshots.takeParsed())
    XCTAssertEqual(snapshot.languageId, "javascript")
    XCTAssertEqual(snapshot.injected.count, 1)
    XCTAssertEqual(snapshot.injected.first?.language.id, "html")
    XCTAssertEqual(snapshot.injected.first?.start, 5)
    XCTAssertEqual(snapshot.injected.first?.end, 13)
    core.setText("html``")
    let empty = try XCTUnwrap(snapshots.takeRevision(1))
    XCTAssertEqual(empty.injected.count, 0, "an empty template string injects nothing")
    engine.close()
  }

  func testSnapshotsCarryTheirLanguage() throws {
    HostLanguages.load("html", "html")
    let engine = engine()
    engine.setLanguage("javascript")
    engine.attach(EditorCore("let a = 1;"))
    let snapshot = try XCTUnwrap(snapshots.takeParsed())
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
    engine.setLanguage("javascript")
    engine.attach(core)
    let first = try XCTUnwrap(snapshots.takeParsed())
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
    engine.setLanguage("javascript")
    engine.attach(core)
    _ = try XCTUnwrap(snapshots.takeParsed())
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
    engine.setLanguage("javascript")
    engine.attach(core)
    _ = try XCTUnwrap(snapshots.takeParsed())
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
    engine.setLanguage("json")
    engine.attach(core)
    _ = try XCTUnwrap(snapshots.takeParsed())
    core.replace(15, 16, "3")
    let snapshot = try XCTUnwrap(snapshots.takeRevision(1))
    XCTAssertEqual(snapshot.basedOn, 0)
    XCTAssertTrue(meetsLine(snapshot.changed, 9, 17))
    engine.close()
  }

  // The worker parses the view each edit hands it, so a writer holding the lock never stalls a parse.
  func testParseFinishesWhileTheWriteLockIsHeld() throws {
    let core = EditorCore("let a = 1;")
    let engine = engine()
    engine.setLanguage("javascript")
    engine.attach(core)
    _ = try XCTUnwrap(snapshots.takeParsed())
    let blocker = hold(engine)
    blocker.started.wait()
    core.replace(4, 5, "b")
    let locked = DispatchSemaphore(value: 0)
    let unlock = DispatchSemaphore(value: 0)
    Thread.detachNewThread {
      cp_test_hold_write(core.document.handle, 1)
      locked.signal()
      unlock.wait()
      cp_test_hold_write(core.document.handle, 0)
    }
    locked.wait()
    blocker.release.signal()
    let snapshot = snapshots.takeRevision(1)
    unlock.signal()
    XCTAssertNotNil(snapshot, "no snapshot while the write lock was held")
    engine.close()
  }

  // Each round lets one budget slice of a parse over several chunks run, then edits: the edit copies at most the
  // chunk it touches and the parse finishes on the view it started on, then catches up.
  func testEditsDuringASplitParseCopyOneChunkEach() throws {
    let base = String(repeating: "a;\n", count: 20_000)
    let core = EditorCore(base)
    let q = snapshots
    let engine = SyntaxEngine(postToMain: { $0() }, onSnapshot: { q.add($0) }, budgetMicros: 1)
    engine.setLanguage("javascript")
    var current = hold(engine)
    current.started.wait()
    engine.attach(core)
    _ = cp_test_units_copied(core.document.handle)
    for i in 1...20 {
      let next = hold(engine)
      current.release.signal()
      current = next
      current.started.wait()
      core.replace(0, 0, "b")
      XCTAssertLessThanOrEqual(cp_test_units_copied(core.document.handle), 16384, "edit \(i)")
    }
    current.release.signal()
    var last: Snapshot?
    while let s = snapshots.take(60) {
      if s.revision == 20 {
        last = s
        break
      }
    }
    let snapshot = try XCTUnwrap(last, "the split parse never published the last edit")
    let lang = try XCTUnwrap(LanguageRegistry.resolve("javascript"))
    let (fresh, _) = parseSnapshot(lang, String(repeating: "b", count: 20) + base)
    XCTAssertEqual(treeString(snapshot), treeString(fresh))
    engine.close()
  }

  // Both documents start at revision 0: a snapshot of the old text posted before a new attach would pass the
  // revision check, so the core drops it before the host sees it and frees it on the worker.
  func testASnapshotPostedBeforeAnAttachIsDroppedAndFreed() throws {
    let posts = PostQueue()
    let q = snapshots
    let engine = SyntaxEngine(postToMain: { posts.add($0) }, onSnapshot: { q.add($0) })
    engine.setLanguage("javascript")
    let old = EditorCore("let a = 1;")
    engine.attach(old)
    engine.queue.sync {}
    XCTAssertGreaterThan(posts.count, 0, "the old text's snapshot is posted")
    let next = EditorCore("{}")
    engine.attach(next)
    engine.queue.sync {}
    posts.runAll()
    var lengths: [Int] = []
    while let s = q.take(0) { lengths.append(s.length) }
    XCTAssertFalse(lengths.contains(10), "a snapshot of the old text reached the host")
    XCTAssertEqual(lengths.last, 2)
    // The dropped snapshot's release runs on the worker queue.
    engine.queue.sync {}
    XCTAssertEqual(cp_test_live_snapshots(engine.pointer), 0)
    engine.close()
  }
}

/// Holds the engine's posts until the test runs them, as a busy main thread would.
private final class PostQueue: @unchecked Sendable {
  private let lock = NSLock()
  private var blocks: [@Sendable () -> Void] = []

  var count: Int { lock.withLock { blocks.count } }

  func add(_ block: @escaping @Sendable () -> Void) { lock.withLock { blocks.append(block) } }

  func runAll() {
    while true {
      let pending = lock.withLock { defer { blocks = [] }; return blocks }
      if pending.isEmpty { return }
      for block in pending { block() }
    }
  }
}
