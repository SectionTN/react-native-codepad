import XCTest

@testable import Codepad

final class EditorCoreThreadTests: XCTestCase {
  // The JS thread reads the selection and the text under the shared lock while the main thread types, so a
  // selection stored outside the lock that wrote the text can point past the end of it.
  func testReadersSeeWholeStateWhileMainTypes() {
    let core = EditorCore(String(repeating: "let a = 1;\n", count: 200))
    let probe = ThreadProbe()
    for _ in 0..<2 {
      probe.start {
        core.read {
          let doc = core.document
          let selection = core.selection
          let length = doc.length
          if selection.min < 0 || selection.max > length { return "selection \(selection) in \(length) units" }
          let full = Array(doc.text().utf16)
          if full.count != length { return "text of \(full.count) units in a document of \(length)" }
          let line = doc.lineAt(selection.head)
          let start = doc.lineStart(line)
          let end = doc.lineEnd(line)
          if Array(doc.line(line)) != Array(full[start..<end]) { return "line \(line) differs from the text" }
          return nil
        }
      }
    }
    for i in 0..<10_000 where probe.failure == nil {
      switch i % 10 {
      case 0: core.insertNewline()
      case 1, 2: core.backspace()
      case 3: if i % 37 == 3 { core.undo() } else { core.typeText("(") }
      case 4: core.move(.docEnd, forward: true, extend: false)
      default: core.typeText("x")
      }
    }
    probe.stop()
    XCTAssertNil(probe.failure)
  }
}
