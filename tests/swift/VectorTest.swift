import Foundation
import XCTest

@testable import Codepad

/// Runs the shared vectors under tests/vectors, one method per file and one activity per case.
@MainActor
final class VectorTest: XCTestCase {
  func testDocument() { runFile("document", cases: 15) }
  func testPositions() { runFile("positions", cases: 4) }
  func testMovement() { runFile("movement", cases: 12) }
  func testUndo() { runFile("undo", cases: 16) }
  func testIndent() { runFile("indent", cases: 16) }
  func testAutoclose() { runFile("autoclose", cases: 16) }
  func testBrackets() { runFile("brackets", cases: 9) }
  func testSearch() { runFile("search", cases: 17) }

  private func runFile(_ area: String, cases expected: Int) {
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
    XCTAssertEqual(cases.count, expected, "\(area) case count")
    for c in cases {
      XCTContext.runActivity(named: c["name"] as? String ?? "unnamed") { _ in VectorRunner(c).run() }
    }
  }
}
