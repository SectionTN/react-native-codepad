import Foundation
import XCTest

@testable import Codepad

/// Every sample's spans against tests/highlight/<id>.spans, recorded from the Kotlin engine.
final class HighlightGoldenTests: XCTestCase {
  private static let dir = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("highlight")

  override class func setUp() {
    super.setUp()
    for (id, grammar) in HostLanguages.packages() { HostLanguages.load(id, grammar) }
  }

  private func render(_ spans: [[Int]]) -> String {
    var out = ""
    for (line, runs) in spans.enumerated() {
      var i = 0
      while i < runs.count {
        out += "\(line) \(runs[i]) \(runs[i + 1]) \(StyleTable.name(runs[i + 2]))\n"
        i += 3
      }
    }
    return out
  }

  func testSpansMatchTheGoldens() throws {
    let files = try FileManager.default.contentsOfDirectory(atPath: Self.dir.path).filter { $0.hasSuffix(".txt") }.sorted()
    XCTAssertFalse(files.isEmpty)
    for file in files {
      let id = String(file.dropLast(4))
      let text = try String(contentsOf: Self.dir.appendingPathComponent(file), encoding: .utf8)
      let snapshots = SnapshotQueue()
      let engine = SyntaxEngine(postToMain: { $0() }, onSnapshot: { snapshots.add($0) })
      engine.setLanguage(id)
      engine.setText(text, revision: 0)
      var snapshot: Snapshot?
      while let s = snapshots.take(10) {
        if s.length == text.utf16.count {
          snapshot = s
          break
        }
      }
      let parsed = try XCTUnwrap(snapshot, "\(id) never parsed")
      let doc = Document(text)
      let lang = try XCTUnwrap(LanguageRegistry.resolve(id))
      let actual = render(Highlighter(language: lang).spans(snapshot: parsed, doc: doc, firstLine: 0, lastLine: doc.lineCount - 1))
      engine.close()
      let expected = try String(contentsOf: Self.dir.appendingPathComponent("\(id).spans"), encoding: .utf8)
      XCTAssertEqual(expected, actual, id)
    }
  }
}
