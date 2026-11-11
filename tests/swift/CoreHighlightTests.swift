import CodepadCore
import Foundation
import XCTest

@testable import Codepad

/// The core's highlighter, frame call and span helpers, driven through its C API.
final class CoreHighlightTests: XCTestCase {
  private static let highlightDir = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("highlight")

  /// Every host language loaded into the core, keyed by grammar id. The Swift registry knows them too, for aliases.
  nonisolated(unsafe) private static let languages: [String: OpaquePointer] = {
    var out: [String: OpaquePointer] = [:]
    for (id, grammar) in HostLanguages.packages() {
      HostLanguages.load(id, grammar)
      let base = FileManager.default.fileExists(atPath: HostLanguages.languagesDir.appendingPathComponent(id).path)
        ? HostLanguages.languagesDir : HostLanguages.modulesDir
      let dir = base.appendingPathComponent(id).appendingPathComponent("queries").appendingPathComponent(grammar)
      let h = Array((try! String(contentsOf: dir.appendingPathComponent("highlights.scm"), encoding: .utf8)).utf8)
      let i = Array(((try? String(contentsOf: dir.appendingPathComponent("injections.scm"), encoding: .utf8)) ?? "").utf8)
      var error = [CChar](repeating: 0, count: 512)
      let pointer = UnsafeRawPointer(HostGrammars.language(named: grammar)!)
      let language = h.withUnsafeBufferPointer { hb in
        i.withUnsafeBufferPointer { ib in
          hb.withMemoryRebound(to: CChar.self) { hc in
            ib.withMemoryRebound(to: CChar.self) { ic in
              cp_language_load(grammar, pointer, hc.baseAddress, UInt32(hc.count), ic.baseAddress, UInt32(ic.count), &error, 512)
            }
          }
        }
      }
      out[grammar] = language!
    }
    return out
  }()

  /// Parses text to a snapshot with a stepping host; the caller releases it.
  private func snapshot(_ id: String, _ text: String) -> OpaquePointer {
    let host = TestHost(threaded: false)
    for (grammar, language) in Self.languages { host.register(grammar, language) }
    host.canonical = { LanguageRegistry.canonicalInjectionId($0) }
    var h = host.host()
    let engine = cp_engine_new(&h, 50_000, TestHost.onSnapshot)!
    cp_engine_set_language(engine, Self.languages[id]!)
    let units = Array(text.utf16)
    cp_engine_set_text(engine, units, UInt32(units.count), 0)
    host.drain()
    host.pump()
    var all = host.takeSnapshots()
    let last = all.removeLast()
    for s in all { cp_engine_release(nil, s) }
    cp_engine_close(engine)
    host.drain()
    host.pump()
    return last
  }

  /// Calls a buffer-filling entry point, growing the buffer once when it is short.
  private func fill(_ call: (UnsafeMutablePointer<Int32>?, UInt32) -> UInt32) -> [Int32] {
    var out = [Int32](repeating: 0, count: 64)
    var needed = out.withUnsafeMutableBufferPointer { call($0.baseAddress, UInt32($0.count)) }
    if needed > out.count {
      out = [Int32](repeating: 0, count: Int(needed))
      needed = out.withUnsafeMutableBufferPointer { call($0.baseAddress, UInt32($0.count)) }
    }
    return Array(out.prefix(Int(needed)))
  }

  private func name(_ style: Int32) -> String {
    var buffer = [CChar](repeating: 0, count: 128)
    _ = cp_style_name(style, &buffer, 128)
    return String(cString: buffer)
  }

  /// Renders cp_highlight lines as the golden files do, from the given line on.
  private func render(_ ints: [Int32], firstLine: Int, lines: Int) -> String {
    var out = ""
    var i = 0
    for line in firstLine..<(firstLine + lines) {
      let count = Int(ints[i])
      i += 1
      for _ in 0..<count {
        out += "\(line) \(ints[i]) \(ints[i + 1]) \(name(ints[i + 2]))\n"
        i += 3
      }
    }
    return out
  }

  func testEverySampleMatchesItsGolden() throws {
    let files = try FileManager.default.contentsOfDirectory(atPath: Self.highlightDir.path).filter { $0.hasSuffix(".txt") }.sorted()
    XCTAssertEqual(files.count, 22)
    for file in files {
      let id = String(file.dropLast(4))
      let text = try String(contentsOf: Self.highlightDir.appendingPathComponent(file), encoding: .utf8)
      let s = snapshot(id, text)
      let lines = text.split(separator: "\n", omittingEmptySubsequences: false).count
      let ints = fill { cp_highlight(s, 0, Int32(lines - 1), 0, $0, $1) }
      let expected = try String(contentsOf: Self.highlightDir.appendingPathComponent("\(id).spans"), encoding: .utf8)
      XCTAssertEqual(render(ints, firstLine: 0, lines: lines), expected, id)
      cp_engine_release(nil, s)
    }
  }

  func testFrameMatchesHighlightPerRun() {
    let text = String(repeating: "const value = call(a, \"s\", [1, 2]); // note\n", count: 40)
    let s = snapshot("javascript", text)
    // Lines with no entry or an older one are all dirty, so the frame finds one run over every line.
    let entries = (0..<40).map { $0 % 2 == 0 ? Int32(-5) : Int32(CP_NO_ENTRY) }
    let lineLength = "const value = call(a, \"s\", [1, 2]); // note\n".utf16.count
    let frame = entries.withUnsafeBufferPointer { e in fill { cp_frame(s, 0, 39, 0, 0, 0, e.baseAddress, $0, $1) } }
    let runs = Int(frame[0])
    XCTAssertEqual(runs, 1)
    XCTAssertEqual(Array(frame[1...2]), [0, 39])
    let plain = fill { cp_highlight(s, 0, 39, 0, $0, $1) }
    XCTAssertEqual(Array(frame[3...]), plain)
    let tail = fill { cp_highlight(s, 10, 12, UInt32(10 * lineLength), $0, $1) }
    XCTAssertEqual(render(tail, firstLine: 10, lines: 3), render(Array(plain), firstLine: 0, lines: 40)
      .split(separator: "\n").filter { $0.hasPrefix("10 ") || $0.hasPrefix("11 ") || $0.hasPrefix("12 ") }
      .joined(separator: "\n") + "\n")
    cp_engine_release(nil, s)
  }

  func testFrameSkipsLinesAlreadyAtTheSnapshotRevision() {
    let text = "let a = 1;\nlet b = 2;\nlet c = 3;\n"
    let s = snapshot("javascript", text)
    let entries: [Int32] = [0, Int32(CP_NO_ENTRY), 0, Int32(CP_NO_ENTRY)]
    let frame = entries.withUnsafeBufferPointer { e in fill { cp_frame(s, 0, 3, 0, 0, 0, e.baseAddress, $0, $1) } }
    XCTAssertEqual(Array(frame[0...4]), [2, 1, 1, 3, 3])
    XCTAssertEqual(Array(frame[5...]), fill { cp_highlight(s, 1, 1, 11, $0, $1) } + fill { cp_highlight(s, 3, 3, 33, $0, $1) })
    cp_engine_release(nil, s)
  }

  func testShortBufferWritesNothingAndReportsTheSize() {
    let s = snapshot("javascript", "const x = 1; // hi")
    var out = [Int32](repeating: 7, count: 2)
    let needed = cp_highlight(s, 0, 0, 0, &out, 2)
    XCTAssertGreaterThan(needed, 2)
    XCTAssertEqual(out, [7, 7])
    cp_engine_release(nil, s)
  }

  func testHighlightAfterCloseReadsFrozenText() {
    let s = snapshot("javascript", "const x = 1; // hi")
    let ints = fill { cp_highlight(s, 0, 0, 0, $0, $1) }
    XCTAssertTrue(render(ints, firstLine: 0, lines: 1).contains("0 13 18 comment"))
    cp_engine_release(nil, s)
  }

  // Ported from DirtyLinesTests: the dirty-run rule now lives in the core.
  private let doc = Array("let a = 1;\nlet b = 2;\nlet c = 3;\n".utf16)

  private func dirtyRuns(revision: Int32, applied: Int32, changed: [Int32]?, entries: [Int32?]) -> [Int32] {
    let e = entries.map { $0 ?? Int32(CP_NO_ENTRY) }
    let c = changed ?? []
    return c.withUnsafeBufferPointer { cb in
      e.withUnsafeBufferPointer { eb in
        fill {
          cp_test_dirty_runs(doc, UInt32(doc.count), 0, 0, 2, revision, applied, cb.baseAddress,
                             changed == nil ? -1 : Int32(c.count), eb.baseAddress, $0, $1)
        }
      }
    }
  }

  // The regression this design removes: every visible line re-queried for a one line edit.
  func testAnEditOnOneLineLeavesTheOtherVisibleLinesAlone() {
    XCTAssertEqual(dirtyRuns(revision: 2, applied: 1, changed: [19, 20], entries: [1, 1, 1]), [1, 1, 1])
  }

  // A deletion's empty span and a region ending on a newline still name their line.
  func testARegionAtALineEndAndAnEmptyRegionDirtyTheirLines() {
    XCTAssertEqual(dirtyRuns(revision: 2, applied: 1, changed: [10, 11], entries: [1, 1, 1]), [1, 0, 0])
    XCTAssertEqual(dirtyRuns(revision: 2, applied: 1, changed: [11, 11], entries: [1, 1, 1]), [1, 1, 1])
    XCTAssertEqual(dirtyRuns(revision: 2, applied: 1, changed: [5, 25], entries: [1, 1, 1]), [1, 0, 2])
    XCTAssertEqual(dirtyRuns(revision: 2, applied: 1, changed: [3, 4, 30, 31], entries: [1, 1, 1]), [2, 0, 0, 2, 2])
  }

  // Lines the regions cannot vouch for: never laid out, laid out plain, or older than the applied snapshot.
  func testAMissingPlainOrOlderEntryIsDirtyWithoutARegion() {
    XCTAssertEqual(dirtyRuns(revision: 2, applied: 1, changed: [], entries: [nil, -1, 0]), [1, 0, 2])
    XCTAssertEqual(dirtyRuns(revision: 2, applied: 1, changed: nil, entries: [1, 1, 1]), [1, 0, 2])
    XCTAssertEqual(dirtyRuns(revision: 2, applied: 1, changed: nil, entries: [2, 2, 2]), [0])
  }

  // Ported from ShiftedSpansTests: the edited line's spans move with a key until the parse lands.
  private let spans: [Int32] = [0, 3, 7, 4, 7, 9]

  private func shifted(_ start: Int32, _ removed: Int32, _ inserted: Int32) -> [Int32] {
    spans.withUnsafeBufferPointer { s in fill { cp_shift_spans(s.baseAddress, UInt32(s.count), start, removed, inserted, $0, $1) } }
  }

  func testTypingInsideOrAtTheEndOfASpanGrowsIt() {
    XCTAssertEqual(shifted(2, 0, 1), [0, 4, 7, 5, 8, 9])
    XCTAssertEqual(shifted(3, 0, 1), [0, 4, 7, 5, 8, 9])
  }

  func testDeletionsShrinkAndReplacementsAcrossSpansCutBoth() {
    XCTAssertEqual(shifted(1, 1, 0), [0, 2, 7, 3, 6, 9])
    XCTAssertEqual(shifted(2, 3, 1), [0, 2, 7, 3, 5, 9])
  }

  func testTypingBeforeASpanShiftsItWithoutJoiningIt() {
    XCTAssertEqual(shifted(4, 0, 1), [0, 3, 7, 5, 8, 9])
  }

  // Ported from SpansTests: a burst of edits stays one region.
  private func coalesced(_ pairs: [Int32]) -> [Int32] {
    pairs.withUnsafeBufferPointer { p in fill { cp_test_coalesce(p.baseAddress, UInt32(p.count), $0, $1) } }
  }

  func testOverlappingAndTouchingPairsMergeAndDisjointOnesStaySorted() {
    XCTAssertEqual(coalesced([8, 9, 4, 6, 0, 2, 2, 5]), [0, 6, 8, 9])
  }

  func testZeroWidthPairsSurviveAndMergeWhenTouched() {
    XCTAssertEqual(coalesced([3, 3]), [3, 3])
    XCTAssertEqual(coalesced([5, 7, 3, 3, 7, 7]), [3, 3, 5, 7])
  }
}
