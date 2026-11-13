import CodepadCore
import Foundation
import XCTest

@testable import Codepad

extension FrameReader {
  /// A frame of lines [first, last] with one entry per line, through the test hook.
  func read(
    core: EditorCore, snapshot: Snapshot?, first: Int, last: Int, applied: Int, useChanged: Bool, entries: [Int32]
  ) -> EditorFrame {
    let handle: OpaquePointer = core.document.handle
    let snap: OpaquePointer? = snapshot?.pointer
    let firstLine = Int32(clamping: first)
    let lastLine = Int32(clamping: last)
    let appliedRevision = Int32(clamping: applied)
    let changed: Int32 = useChanged ? 1 : 0
    return read(window: (first, last)) { out, cap, text, textCap, length in
      entries.withUnsafeBufferPointer { e in
        cp_test_frame_range(
          handle, snap, firstLine, lastLine, appliedRevision, changed, e.baseAddress, out, cap, text, textCap, length)
      }
    }
  }
}

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
      let runs = dirtyRuns(
        doc, painted, revision: snapshot.revision, applied: applied, changed: useChanged ? snapshot.changed : nil,
        entries: Array(entries[0...(painted.last - first)]))
      XCTAssertEqual(painted.runs, runs, "step \(step)")
      var expected: [[Int]] = []
      var r = 0
      while r + 1 < runs.count {
        for line in runs[r]...runs[r + 1] {
          expected.append(highlighter.spans(snapshot: snapshot, doc: doc, firstLine: line, lastLine: line)[0])
        }
        r += 2
      }
      XCTAssertEqual(painted.spans, expected, "step \(step)")
    }
  }

  // The draw hands the cache to the layout's frame call as (line, revision) pairs and lets the layout pick the
  // window. Read densely over that window, the frame must paint the same lines with the same spans and text.
  func testSparseEntriesMatchDenseEntries() throws {
    var rng = SplitMix(state: 11)
    let block = ["function f(a, b) {", "  const s = `x${a}`; // c", "  return a + b * 2;", "}", "let re = /ab+c/g;", ""]
    let text = (0..<10_000).map { block[$0 % block.count] }.joined(separator: "\n")
    let core = EditorCore(text)
    let snapshots = SnapshotQueue()
    let engine = SyntaxEngine(postToMain: { $0() }, onSnapshot: { snapshots.add($0) })
    defer { engine.close() }
    engine.setLanguage("javascript")
    engine.attach(core)
    let viewport = Viewport()
    viewport.attach(core)
    viewport.rowHeight = 1
    viewport.resize(width: 100, height: 29)
    let reader = FrameReader(ints: 4, units: 4)
    let inserts = ["", "x", "\n", "/*", "\"", "ab\ncd", "}"]
    for step in 0..<500 {
      let doc = core.document
      let at = Int.random(in: 0...doc.length, using: &rng)
      core.replace(at, min(doc.length, at + Int.random(in: 0...3, using: &rng)), inserts.randomElement(using: &rng)!)
      viewport.scrollTo(0, Int.random(in: 0..<doc.lineCount, using: &rng))
      let top = viewport.firstVisibleLine()
      var cached: [Int: Int32] = [:]
      for line in max(0, top - 10)...min(doc.lineCount - 1, top + 40) where Bool.random(using: &rng) {
        cached[line] = Int32(doc.revision)
      }
      // The cache lists its entries in no particular order.
      var pairs: [Int32] = []
      for (line, revision) in cached.sorted(by: { $0.key < $1.key }).shuffled(using: &rng) {
        pairs += [Int32(line), revision]
      }
      let snapshot = step % 25 == 0 ? try XCTUnwrap(snapshots.takeRevision(doc.revision, 30), "step \(step)") : nil
      let applied = snapshot?.basedOn ?? doc.revision - 1
      let useChanged = snapshot != nil && Bool.random(using: &rng)
      let sparse = reader.read(
        core: core, layout: viewport, snapshot: snapshot, applied: applied, useChanged: useChanged, pairs: pairs)
      XCTAssertEqual(sparse.first, top, "step \(step)")
      XCTAssertEqual(sparse.last, min(doc.lineCount - 1, top + 30), "step \(step)")
      let entries = (sparse.first...sparse.last).map { cached[$0] ?? Int32(CP_NO_ENTRY) }
      let dense = reader.read(
        core: core, snapshot: snapshot, first: sparse.first, last: sparse.last, applied: applied,
        useChanged: useChanged, entries: entries)
      XCTAssertEqual(sparse.runs, dense.runs, "step \(step)")
      XCTAssertEqual(sparse.spans, dense.spans, "step \(step)")
      var r = 0
      while r + 1 < sparse.runs.count {
        for line in sparse.runs[r]...sparse.runs[r + 1] {
          XCTAssertEqual(sparse.text(line), dense.text(line), "step \(step) line \(line)")
        }
        r += 2
      }
    }
  }

  // The core's dirty-run rule over the frame's lines, the oracle for the runs a frame paints.
  private func dirtyRuns(
    _ doc: Document, _ f: EditorFrame, revision: Int, applied: Int, changed: [Int]?, entries: [Int32]
  ) -> [Int] {
    let text = Array(doc.text().utf16)
    let c = (changed ?? []).map { Int32($0) }
    var out = [Int32](repeating: 0, count: 2 + entries.count * 2)
    let n = c.withUnsafeBufferPointer { cb in
      entries.withUnsafeBufferPointer { eb in
        out.withUnsafeMutableBufferPointer { ob in
          cp_test_dirty_runs(
            text, UInt32(text.count), UInt32(doc.lineStart(f.first)), Int32(f.first), Int32(f.last), Int32(revision),
            Int32(applied), cb.baseAddress, changed == nil ? -1 : Int32(c.count), eb.baseAddress, ob.baseAddress,
            UInt32(ob.count))
        }
      }
    }
    XCTAssertLessThanOrEqual(Int(n), out.count)
    return out[1..<(1 + Int(out[0]) * 2)].map { Int($0) }
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
