import Foundation
import XCTest

@testable import Codepad

/// Replays the keyboard sessions under tests/ime-ios against a fresh core and checks the state after every call.
final class MarkedTextReplayTests: XCTestCase {
  func testReplay() throws {
    let dir = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("ime-ios")
    let files = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasSuffix(".json") }.sorted()
    XCTAssertFalse(files.isEmpty, "no recordings under \(dir.path)")
    for file in files {
      let data = try Data(contentsOf: dir.appendingPathComponent(file))
      let root = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
      let sessions = try XCTUnwrap(root["sessions"] as? [[String: Any]])
      for (i, session) in sessions.enumerated() { replay(session, label: "\(file) session \(i + 1)") }
    }
  }

  private func replay(_ session: [String: Any], label: String) {
    guard let initial = session["initial"] as? [String: Any], let text = initial["text"] as? String,
      let sel = initial["selection"] as? [Int], sel.count == 2
    else {
      XCTFail("\(label): bad initial state")
      return
    }
    let core = EditorCore(text)
    core.setSelection(anchor: sel[0], head: sel[1])
    let s = MarkedTextSession(core: core)
    let steps = session["steps"] as? [[String: Any]] ?? []
    for (i, step) in steps.enumerated() {
      let call = step["call"] as? String ?? ""
      let args = step["args"] as? [Any] ?? []
      let at = "\(label) step \(i + 1) (\(call))"
      switch call {
      case "insertText":
        s.insertText(args.first as? String ?? "")
      case "setMarkedText":
        let r = args.count > 1 ? args[1] as? [Int] ?? [0, 0] : [0, 0]
        s.setMarkedText(args.first as? String ?? "", selectedRange: NSRange(location: r[0], length: r[1]))
      case "unmarkText":
        s.unmarkText()
      case "deleteBackward":
        s.deleteBackward()
      case "replace":
        let r = args.first as? [Int] ?? [0, 0]
        s.replace(TextRange(start: r[0], end: r[1]), with: args.count > 1 ? args[1] as? String ?? "" : "")
      case "setSelection":
        let r = args.first as? [Int] ?? [0, 0]
        s.setSelection(Selection(anchor: r[0], head: r[1]))
      default:
        XCTFail("\(at): unknown call")
      }
      guard let after = step["after"] as? [String: Any] else { continue }
      if let v = after["sel"] as? [Int] { XCTAssertEqual(core.selection, Selection(anchor: v[0], head: v[1]), "\(at) selection") }
      if after.keys.contains("marked") {
        let expected = (after["marked"] as? [Int]).map { TextRange(start: $0[0], end: $0[1]) }
        XCTAssertEqual(s.marked, expected, "\(at) marked")
      }
      if let v = after["len"] as? Int { XCTAssertEqual(core.document.length, v, "\(at) length") }
      if let v = after["text"] as? String { XCTAssertEqual(core.document.text(), v, "\(at) text") }
    }
  }
}
