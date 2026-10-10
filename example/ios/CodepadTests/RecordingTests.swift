import UIKit
import XCTest

@testable import Codepad

@MainActor
final class RecordingTests: XCTestCase {
  override func tearDown() {
    UserDefaults.standard.removeObject(forKey: "codepad_debug")
    super.tearDown()
  }

  func testRecorderLogsTheCallsWhenTheSwitchIsOn() throws {
    UserDefaults.standard.set(true, forKey: "codepad_debug")
    let editor = launch()
    editor.setInitialText("x = ")
    editor.core.setSelection(anchor: 4, head: 4)
    layout(editor)
    var lines: [String] = []
    editor.textInput.recorderLog = { lines.append($0) }
    editor.focus()
    let input = editor.textInput
    input.insertText("a")
    input.setMarkedText("k", selectedRange: NSRange(location: 1, length: 0))
    let entries = try lines.map { try XCTUnwrap(JSONSerialization.jsonObject(with: Data($0.utf8)) as? [String: Any]) }
    XCTAssertEqual(entries.first?["call"] as? String, "open")
    XCTAssertEqual((entries.first?["after"] as? [String: Any])?["text"] as? String, "x = ")
    // The keyboard may add calls of its own on focus, so the last two are ours.
    let ours = Array(entries.suffix(2))
    XCTAssertEqual(ours.map { $0["call"] as? String }, ["insertText", "setMarkedText"])
    guard ours.count == 2 else { return }
    XCTAssertEqual(ours[0]["args"] as? [String], ["a"])
    let afterInsert = try XCTUnwrap(ours[0]["after"] as? [String: Any])
    XCTAssertEqual(afterInsert["sel"] as? [Int], [5, 5])
    XCTAssertTrue(afterInsert["marked"] is NSNull)
    XCTAssertEqual(afterInsert["len"] as? Int, 5)
    XCTAssertEqual(afterInsert["text"] as? String, "x = a")
    let args = try XCTUnwrap(ours[1]["args"] as? [Any])
    XCTAssertEqual(args.first as? String, "k")
    XCTAssertEqual(args.last as? [Int], [1, 0])
    let afterMark = try XCTUnwrap(ours[1]["after"] as? [String: Any])
    XCTAssertEqual(afterMark["marked"] as? [Int], [5, 6])
    XCTAssertEqual(afterMark["text"] as? String, "x = ak")
    XCTAssertGreaterThanOrEqual(ours[1]["t"] as? Int ?? -1, 0)
    // Off, nothing more is logged.
    UserDefaults.standard.set(false, forKey: "codepad_debug")
    let count = lines.count
    input.unmarkText()
    XCTAssertEqual(lines.count, count)
  }
}
