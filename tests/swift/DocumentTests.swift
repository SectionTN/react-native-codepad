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
}
