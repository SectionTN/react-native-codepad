import CodepadCore
import XCTest

@testable import Codepad

final class DocumentTests: XCTestCase {
  private final class Shared: @unchecked Sendable {
    private let lock = NSLock()
    private var stopped = false
    private var problem: String?
    var isStopped: Bool { lock.withLock { stopped } }
    var failure: String? { lock.withLock { problem } }
    func stop() { lock.withLock { stopped = true } }
    func fail(_ message: String) { lock.withLock { if problem == nil { problem = message } } }
  }

  // The view reads on the main thread without the lock while the JS thread and the search job read under it,
  // so a reader that rebuilds the line starts tears the table for the other one.
  func testALockedReaderSeesWholeLineStartsWhileTheWriterThreadReadsUnlocked() {
    let core = EditorCore(String(repeating: "let a = 1;\n", count: 3000))
    let shared = Shared()
    let done = DispatchSemaphore(value: 0)
    DispatchQueue.global(qos: .userInitiated).async {
      defer { done.signal() }
      while !shared.isStopped {
        let problem: String? = core.read {
          let doc = core.document
          let text = doc.text()
          if text.utf16.count != doc.length {
            return "text of \(text.utf16.count) units in a document of \(doc.length)"
          }
          let probe = doc.length / 2
          let p = doc.offsetToPosition(probe)
          let back = doc.positionToOffset(line: p.line, column: p.column)
          if back != probe { return "offset \(probe) maps to \(p) and back to \(back)" }
          return nil
        }
        if let problem {
          shared.fail(problem)
          return
        }
      }
    }
    let deadline = DispatchTime.now() + .milliseconds(400)
    var i = 0
    while DispatchTime.now() < deadline && shared.failure == nil {
      let at = (i * 7919) % core.document.length
      core.replace(at, at, i % 8 == 0 ? "\n" : "x")
      // The view's layout pass: an unlocked read right after the edit.
      _ = core.document.lineAt(core.selection.head)
      i += 1
    }
    shared.stop()
    done.wait()
    XCTAssertNil(shared.failure)
  }

  private func chunkEnds(_ doc: Document) -> [UInt32] {
    var out = [UInt32](repeating: 0, count: 4096)
    let n = cp_test_chunk_ends(doc.handle, &out, UInt32(out.count))
    return Array(out.prefix(Int(n)))
  }

  // Tree-sitter reads a lone high surrogate at a chunk end as a code point of its own, without fetching the next chunk.
  func testNoChunkEndsOnAHighSurrogate() {
    cp_test_set_chunk_limits(4, 2)
    defer { cp_test_set_chunk_limits(0, 0) }
    let emoji = "\u{1F600}"
    let cumulative = Document("abcdefgh")
    var expected = Array("abcdefgh".utf16)
    for at in 0...8 {
      let single = Document("abcdefgh")
      single.replace(at, at, emoji)
      cumulative.replace(at * 3, at * 3, emoji)
      expected.insert(contentsOf: emoji.utf16, at: at * 3)
      XCTAssertEqual(Array(cumulative.text().utf16), expected)
      for doc in [single, cumulative] {
        let units = Array(doc.text().utf16)
        for end in chunkEnds(doc).dropLast() {
          XCTAssertFalse(UTF16.isLeadSurrogate(units[Int(end) - 1]), "chunk ends at \(end) in \(units.count) units")
        }
      }
    }
  }

  func testEditOfASharedViewClonesOneChunk() throws {
    let doc = Document(String(repeating: "abcdefghi\n", count: 20_000))
    _ = cp_test_units_copied(doc.handle)
    let view = try XCTUnwrap(cp_editor_text(doc.handle))
    defer { cp_text_release(view) }
    doc.replace(0, 0, "x")
    XCTAssertLessThanOrEqual(cp_test_units_copied(doc.handle), 16384)
    XCTAssertEqual(cp_text_length(view), 200_000)
    var head = [UInt16](repeating: 0, count: 3)
    XCTAssertEqual(cp_text_copy(view, 0, 3, &head, 3), 3)
    XCTAssertEqual(String(decoding: head, as: UTF16.self), "abc")
    XCTAssertEqual(doc.text(0, 3), "xab")
  }
}
