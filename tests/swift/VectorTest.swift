import Foundation
import XCTest

@testable import Codepad

/// Runs the shared vectors under tests/vectors, one method per file and one activity per case.
@MainActor
final class VectorTest: XCTestCase {
  func testDocument() { runFile("document") }
  func testPositions() { runFile("positions") }
  func testMovement() { runFile("movement") }
  func testUndo() { runFile("undo") }
  func testIndent() { runFile("indent") }
  func testAutoclose() { runFile("autoclose") }
  func testBrackets() { runFile("brackets") }
  func testSearch() { runFile("search") }

  private func runFile(_ area: String) {
    let url = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent().deletingLastPathComponent()
      .appendingPathComponent("vectors").appendingPathComponent("\(area).json")
    guard let data = try? Data(contentsOf: url),
      let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let cases = root["cases"] as? [[String: Any]]
    else {
      XCTFail("cannot load \(url.path)")
      return
    }
    XCTAssertFalse(cases.isEmpty, "\(area) has no cases")
    for c in cases {
      XCTContext.runActivity(named: c["name"] as? String ?? "unnamed") { _ in VectorRunner(c).run() }
    }
  }
}
