import CodepadCore
import Foundation
import XCTest

@testable import Codepad

/// A cp_host in Swift. Stepping runs work only when the test drains it; threaded uses real queues.
final class TestHost: @unchecked Sendable {
  typealias Work = (@convention(c) (UnsafeMutableRawPointer?) -> Void)?
  private struct Item {
    let work: Work
    let arg: UnsafeMutableRawPointer?
  }

  let threaded: Bool
  private let lock = NSLock()
  private var queued: [Item] = []
  private var posted: [Item] = []
  private var clock: Int64 = 0
  private let worker = DispatchQueue(label: "codepad.test.worker")
  private let main = DispatchQueue(label: "codepad.test.main")
  private var languages: [String: OpaquePointer] = [:]
  private var snapshots: [OpaquePointer] = []
  private var finals = 0
  var finalPosts: Int { lock.withLock { finals } }
  private let delivered = DispatchSemaphore(value: 0)

  init(threaded: Bool) { self.threaded = threaded }

  func register(_ id: String, _ language: OpaquePointer) { lock.withLock { languages[id] = language } }

  func host() -> cp_host {
    var h = cp_host()
    h.ctx = Unmanaged.passUnretained(self).toOpaque()
    h.schedule = { ctx, work, arg in TestHost.from(ctx).schedule(work, arg) }
    h.post_main = { ctx, work, arg in TestHost.from(ctx).post(work, arg) }
    h.now_micros = { ctx in TestHost.from(ctx).now() }
    h.resolve = { ctx, id in TestHost.from(ctx).resolve(id) }
    return h
  }

  static func from(_ ctx: UnsafeMutableRawPointer?) -> TestHost { Unmanaged<TestHost>.fromOpaque(ctx!).takeUnretainedValue() }

  static let onSnapshot: @convention(c) (UnsafeMutableRawPointer?, OpaquePointer?) -> Void = { ctx, snapshot in
    let host = TestHost.from(ctx)
    host.lock.withLock {
      if let snapshot { host.snapshots.append(snapshot) } else { host.finals += 1 }
    }
    host.delivered.signal()
  }

  private func schedule(_ work: Work, _ arg: UnsafeMutableRawPointer?) {
    if threaded { worker.async { work?(arg) } } else { lock.withLock { queued.append(Item(work: work, arg: arg)) } }
  }

  private func post(_ work: Work, _ arg: UnsafeMutableRawPointer?) {
    if threaded { main.async { work?(arg) } } else { lock.withLock { posted.append(Item(work: work, arg: arg)) } }
  }

  // Every read moves the clock, so a budget runs out after a few progress checks.
  private func now() -> Int64 { lock.withLock { clock += 10; return clock } }

  private func resolve(_ id: UnsafePointer<CChar>?) -> OpaquePointer? {
    let name = String(cString: id!)
    return lock.withLock { languages[name] }
  }

  /// Runs queued work one item at a time until none is left, returning how many items ran.
  @discardableResult
  func drain() -> Int {
    var ran = 0
    while let item = lock.withLock({ queued.isEmpty ? nil : queued.removeFirst() }) {
      item.work?(item.arg)
      ran += 1
    }
    return ran
  }

  /// Runs one queued item, false when none is left.
  func step() -> Bool {
    guard let item = lock.withLock({ queued.isEmpty ? nil : queued.removeFirst() }) else { return false }
    item.work?(item.arg)
    return true
  }

  func pump() {
    while let item = lock.withLock({ posted.isEmpty ? nil : posted.removeFirst() }) { item.work?(item.arg) }
  }

  func takeSnapshots() -> [OpaquePointer] { lock.withLock { defer { snapshots = [] }; return snapshots } }

  /// Threaded host only: waits for the next delivery on the main queue.
  func waitDelivery(_ timeout: TimeInterval = 10) -> Bool { delivered.wait(timeout: .now() + timeout) == .success }
}

final class CoreEngineTests: XCTestCase {
  private static func load(_ grammar: String) -> OpaquePointer {
    let pkg = HostLanguages.packages().first { $0.grammar == grammar }!.id
    let base = FileManager.default.fileExists(atPath: HostLanguages.languagesDir.appendingPathComponent(pkg).path)
      ? HostLanguages.languagesDir : HostLanguages.modulesDir
    let dir = base.appendingPathComponent(pkg).appendingPathComponent("queries").appendingPathComponent(grammar)
    let highlights = Array((try! String(contentsOf: dir.appendingPathComponent("highlights.scm"), encoding: .utf8)).utf8)
    let injections = Array(((try? String(contentsOf: dir.appendingPathComponent("injections.scm"), encoding: .utf8)) ?? "").utf8)
    var error = [CChar](repeating: 0, count: 512)
    let pointer = UnsafeRawPointer(HostGrammars.language(named: grammar)!)
    let language = highlights.withUnsafeBufferPointer { h in
      injections.withUnsafeBufferPointer { i in
        h.withMemoryRebound(to: CChar.self) { hc in
          i.withMemoryRebound(to: CChar.self) { ic in
            cp_language_load(grammar, pointer, hc.baseAddress, UInt32(hc.count), ic.baseAddress, UInt32(ic.count), &error, 512)
          }
        }
      }
    }
    return language!
  }

  // Loaded languages are immutable and live for the process.
  nonisolated(unsafe) private static let javascript = load("javascript")
  nonisolated(unsafe) private static let json = load("json")

  private func info(_ s: OpaquePointer) -> cp_snapshot_info {
    var out = cp_snapshot_info()
    cp_snapshot_info_get(s, &out)
    return out
  }

  private func languageId(_ s: OpaquePointer) -> String { String(cString: cp_language_id(cp_snapshot_language(s))) }

  private func setText(_ engine: OpaquePointer, _ text: String, _ revision: Int32) {
    let units = Array(text.utf16)
    cp_engine_set_text(engine, units, UInt32(units.count), revision)
  }

  /// One-line insert, the way the platform documents compute points.
  private func insert(_ engine: OpaquePointer, at start: Int, line: Int, column: Int, _ text: String, revision: Int32) {
    let units = Array(text.utf16)
    let p = cp_point(line: Int32(line), column: Int32(column))
    let end = cp_point(line: Int32(line), column: Int32(column + units.count))
    cp_engine_edit(engine, UInt32(start), 0, units, UInt32(units.count), revision, p, p, end)
  }

  private func engine(_ host: TestHost, budget: Int64 = 50_000) -> OpaquePointer {
    var h = host.host()
    return cp_engine_new(&h, budget, TestHost.onSnapshot)!
  }

  func testPublishesSnapshotsForTextAndEdits() {
    let host = TestHost(threaded: false)
    let engine = engine(host)
    cp_engine_set_language(engine, Self.javascript)
    setText(engine, "let a = 1;", 0)
    host.drain()
    host.pump()
    let first = host.takeSnapshots().last!
    XCTAssertEqual(info(first).revision, 0)
    XCTAssertEqual(cp_snapshot_length(first), 10)
    XCTAssertEqual(languageId(first), "javascript")
    insert(engine, at: 4, line: 0, column: 4, "bc", revision: 1)
    host.drain()
    host.pump()
    let second = host.takeSnapshots()
    XCTAssertEqual(second.count, 1)
    XCTAssertEqual(info(second[0]).revision, 1)
    XCTAssertEqual(cp_snapshot_length(second[0]), 12)
    cp_engine_release(engine, first)
    cp_engine_release(engine, second[0])
    cp_engine_close(engine)
    host.drain()
    host.pump()
    XCTAssertEqual(host.finalPosts, 1)
  }

  func testBurstsOfEditsCoalesceIntoTheLatestRevision() {
    let host = TestHost(threaded: false)
    let engine = engine(host)
    cp_engine_set_language(engine, Self.javascript)
    setText(engine, "", 0)
    host.drain()
    host.pump()
    for s in host.takeSnapshots() { cp_engine_release(engine, s) }
    for i in 0..<200 { insert(engine, at: i, line: 0, column: i, "x", revision: Int32(i + 1)) }
    host.drain()
    host.pump()
    let burst = host.takeSnapshots()
    XCTAssertEqual(burst.count, 1)
    XCTAssertEqual(info(burst[0]).revision, 200)
    XCTAssertEqual(cp_snapshot_length(burst[0]), 200)
    cp_engine_release(engine, burst[0])
    cp_engine_close(engine)
    host.drain()
    host.pump()
  }

  func testEditsBetweenEveryBudgetSliceStillPublish() {
    let host = TestHost(threaded: false)
    let engine = engine(host, budget: 30)
    let text = String(repeating: "let value = call(a, b, [1, 2, 3]);\n", count: 2000)
    cp_engine_set_language(engine, Self.javascript)
    setText(engine, text, 0)
    var revision: Int32 = 0
    var offset = text.utf16.count
    // An edit lands after every slice, so the parse only ever finishes on the text it froze.
    for _ in 0..<5 where host.step() {
      revision += 1
      insert(engine, at: offset, line: 2000, column: offset - text.utf16.count, "x", revision: revision)
      offset += 1
    }
    host.drain()
    host.pump()
    let all = host.takeSnapshots()
    XCTAssertFalse(all.isEmpty)
    XCTAssertEqual(info(all.last!).revision, revision)
    XCTAssertEqual(cp_snapshot_length(all.last!), UInt32(offset))
    for s in all { cp_engine_release(engine, s) }
    cp_engine_close(engine)
    host.drain()
    host.pump()
  }

  func testSnapshotAfterLanguageSwitchCarriesOldLanguage() {
    let host = TestHost(threaded: false)
    let engine = engine(host)
    cp_engine_set_language(engine, Self.javascript)
    setText(engine, "[1, 2]", 0)
    _ = host.step()
    _ = host.step()
    cp_engine_set_language(engine, Self.json)
    host.drain()
    host.pump()
    let all = host.takeSnapshots()
    XCTAssertEqual(all.map { languageId($0) }, ["javascript", "json"])
    for s in all { cp_engine_release(engine, s) }
    cp_engine_close(engine)
    host.drain()
    host.pump()
  }

  func testCloseDuringSplitParseRunsNothingAfter() {
    let host = TestHost(threaded: false)
    let engine = engine(host, budget: 1)
    cp_engine_set_language(engine, Self.javascript)
    setText(engine, String(repeating: "let a = [1, 2, 3];\n", count: 100_000), 0)
    _ = host.step()
    _ = host.step()
    cp_engine_close(engine)
    // The slice queued before close may queue one more before the close runs. After it nothing parses,
    // where an engine ignoring close would run hundreds of 1 µs slices over this text.
    XCTAssertLessThanOrEqual(host.drain(), 3)
    host.pump()
    XCTAssertTrue(host.takeSnapshots().isEmpty)
    XCTAssertEqual(host.finalPosts, 1)
  }

  func testLanguageSwitchRaceThreaded() {
    let host = TestHost(threaded: true)
    let engine = engine(host)
    cp_engine_set_language(engine, Self.javascript)
    setText(engine, String(repeating: "let a = [1, 2];\n", count: 5000), 0)
    cp_engine_set_language(engine, Self.json)
    cp_engine_set_language(engine, Self.javascript)
    while host.waitDelivery(2) {
      for s in host.takeSnapshots() { cp_engine_release(engine, s) }
    }
    cp_engine_close(engine)
    XCTAssertTrue(host.waitDelivery())
    for s in host.takeSnapshots() { cp_engine_release(nil, s) }
    XCTAssertEqual(host.finalPosts, 1)
  }

  func testCloseRaceThreaded() {
    let host = TestHost(threaded: true)
    let engine = engine(host, budget: 50)
    cp_engine_set_language(engine, Self.javascript)
    setText(engine, String(repeating: "let a = [1, 2, 3];\n", count: 50_000), 0)
    cp_engine_close(engine)
    while host.waitDelivery() {
      if host.finalPosts == 1 { break }
    }
    XCTAssertEqual(host.finalPosts, 1)
    for s in host.takeSnapshots() { cp_engine_release(nil, s) }
  }
}
