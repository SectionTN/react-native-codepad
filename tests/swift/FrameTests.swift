import CodepadCore
import Foundation
import XCTest

@testable import Codepad

final class FrameTests: XCTestCase {
  private struct SplitMix: RandomNumberGenerator {
    var state: UInt64
    mutating func next() -> UInt64 {
      state &+= 0x9E37_79B9_7F4A_7C15
      var z = state
      z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
      z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
      return z ^ (z >> 31)
    }
  }

  override func setUp() {
    super.setUp()
    _ = HostLanguages.javascript()
  }

  // A frame encoder that drifts from the plain reads would paint one line's text or spans on another line.
  func testFrameMatchesSeparateReads() throws {
    var rng = SplitMix(state: 7)
    let block = ["function f(a, b) {", "  const s = `x${a}`; // c", "  return a + b * 2;", "}", "let re = /ab+c/g;", ""]
    let text = (0..<10_000).map { block[$0 % block.count] }.joined(separator: "\n")
    let core = EditorCore(text)
    let snapshots = SnapshotQueue()
    let engine = SyntaxEngine(postToMain: { $0() }, onSnapshot: { snapshots.add($0) })
    defer { engine.close() }
    engine.setLanguage("javascript")
    engine.attach(core)
    let lang = try XCTUnwrap(LanguageRegistry.resolve("javascript"))
    let highlighter = Highlighter(language: lang)
    // Tiny buffers, so both grow paths run on the first frame.
    let reader = FrameReader(ints: 4, units: 4)
    let inserts = ["", "x", "\n", "/*", "\"", "ab\ncd", "}"]
    for step in 0..<500 {
      let doc = core.document
      let at = Int.random(in: 0...doc.length, using: &rng)
      core.replace(at, min(doc.length, at + Int.random(in: 0...3, using: &rng)), inserts.randomElement(using: &rng)!)
      core.setSelection(anchor: Int.random(in: 0...doc.length, using: &rng), head: Int.random(in: 0...doc.length, using: &rng))
      let first = Int.random(in: 0..<doc.lineCount, using: &rng)
      let last = first + 30
      let entries: [Int32] = (first...last).map { _ in
        Bool.random(using: &rng) ? Int32(CP_NO_ENTRY) : Int32(doc.revision)
      }
      let plain = reader.read(
        core: core, snapshot: nil, first: first, last: last, applied: doc.revision - 1, useChanged: false, entries: entries)
      try checkReads(plain, core, first, last, step)
      var expectedRuns: [Int] = []
      for line in plain.first...plain.last where entries[line - first] == Int32(CP_NO_ENTRY) {
        if let end = expectedRuns.last, end == line - 1 {
          expectedRuns[expectedRuns.count - 1] = line
        } else {
          expectedRuns += [line, line]
        }
      }
      XCTAssertEqual(plain.runs, expectedRuns, "step \(step): without a snapshot the runs are the lines with no entry")
      XCTAssertTrue(plain.spans.allSatisfy { $0.isEmpty }, "step \(step)")
      if step % 25 != 0 { continue }
      let snapshot = try XCTUnwrap(snapshots.takeRevision(doc.revision, 30), "step \(step): no snapshot")
      let useChanged = Bool.random(using: &rng)
      let applied = snapshot.basedOn
      let painted = reader.read(
        core: core, snapshot: snapshot, first: first, last: last, applied: applied, useChanged: useChanged,
        entries: entries)
      try checkReads(painted, core, first, last, step)
      let legacy = highlighter.frame(
        snapshot: snapshot, doc: doc, first: painted.first, last: painted.last, applied: applied, useChanged: useChanged,
        entries: Array(entries[0...(painted.last - first)]))
      XCTAssertEqual(painted.runs, legacy.runs, "step \(step)")
      XCTAssertEqual(painted.spans, legacy.spans, "step \(step)")
    }
  }

  private func checkReads(_ f: EditorFrame, _ core: EditorCore, _ first: Int, _ last: Int, _ step: Int) throws {
    let doc = core.document
    XCTAssertEqual(f.revision, doc.revision, "step \(step)")
    XCTAssertEqual(f.length, doc.length, "step \(step)")
    XCTAssertEqual(f.lineCount, doc.lineCount, "step \(step)")
    XCTAssertEqual(f.anchor, core.selection.anchor, "step \(step)")
    XCTAssertEqual(f.head, core.selection.head, "step \(step)")
    XCTAssertEqual(f.caretLine, doc.lineAt(core.selection.head), "step \(step)")
    XCTAssertEqual(f.decorationsVersion, Int(cp_editor_decorations_version(doc.handle)), "step \(step)")
    XCTAssertEqual(f.history, Int(cp_editor_history(doc.handle)), "step \(step)")
    XCTAssertEqual(f.first, first, "step \(step)")
    XCTAssertEqual(f.last, min(last, doc.lineCount - 1), "step \(step)")
    for line in f.first...(f.last + 1) {
      XCTAssertEqual(f.lineStart(line), doc.lineStart(line), "step \(step) line \(line)")
    }
    var r = 0
    while r + 1 < f.runs.count {
      for line in f.runs[r]...f.runs[r + 1] {
        XCTAssertEqual(f.text(line), doc.line(line), "step \(step) line \(line)")
      }
      r += 2
    }
  }
}
