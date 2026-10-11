import Foundation
import XCTest

@testable import Codepad

final class TreeSitterTests: XCTestCase {
  private func edit(_ start: Int, _ oldEnd: Int, _ newEnd: Int) -> InputEdit {
    InputEdit(
      start: start, oldEnd: oldEnd, newEnd: newEnd, startPoint: Point(row: 0, column: start),
      oldEndPoint: Point(row: 0, column: oldEnd), newEndPoint: Point(row: 0, column: newEnd))
  }

  func testParsesJavascriptWithUnitOffsets() throws {
    let parser = Parser()
    XCTAssertTrue(parser.setLanguage(HostGrammars.javascript()))
    let mirror = Mirror()
    mirror.setText("let x = \"\u{1F600}\";")
    let tree = try XCTUnwrap(parser.parse(nil, mirror, nil, budgetMicros: 0))
    let root = tree.rootNode
    XCTAssertEqual(root.type, "program")
    XCTAssertEqual(root.startUnit, 0)
    XCTAssertEqual(root.endUnit, 13)
    XCTAssertEqual(root.endPoint, Point(row: 0, column: 13))
    let decl = root.child(0)
    XCTAssertEqual(decl.type, "lexical_declaration")
    XCTAssertEqual(decl.parent.type, "program")
    XCTAssertFalse(root.isNull)
    XCTAssertTrue(root.parent.isNull)
  }

  func testCancelFlagAbortsAndResetAllowsRestart() throws {
    let parser = Parser()
    _ = parser.setLanguage(HostGrammars.javascript())
    let mirror = Mirror()
    mirror.setText(String(repeating: "let a = 1;\n", count: 20_000))
    let flag = CancelFlag()
    flag.set(true)
    XCTAssertNil(parser.parse(nil, mirror, flag, budgetMicros: 0))
    parser.reset()
    flag.set(false)
    XCTAssertNotNil(parser.parse(nil, mirror, flag, budgetMicros: 0))
  }

  func testBudgetReturnsNilAndResumes() throws {
    let parser = Parser()
    _ = parser.setLanguage(HostGrammars.javascript())
    let mirror = Mirror()
    mirror.setText(String(repeating: "let a = 1;\n", count: 20_000))
    XCTAssertNil(parser.parse(nil, mirror, nil, budgetMicros: 1_000))
    let tree = try XCTUnwrap(parser.parse(nil, mirror, nil, budgetMicros: 0))
    XCTAssertEqual(tree.rootNode.endUnit, 11 * 20_000)
  }

  func testQueryExposesCapturesAndPredicateSteps() throws {
    let query = try Query.compile(HostGrammars.javascript(), "((identifier) @c (#match? @c \"^[A-Z]\"))")
    XCTAssertEqual(query.patternCount, 1)
    XCTAssertEqual(query.captureNames, ["c"])
    let steps = query.predicates(0)
    XCTAssertEqual([steps[0], steps[2], steps[4], steps[6]], [2, 1, 2, 0])
    XCTAssertEqual(query.stringValues[steps[1]], "match?")
    XCTAssertEqual(query.stringValues[steps[5]], "^[A-Z]")
  }

  func testQueryCursorReturnsCapturesInRange() throws {
    let lang = HostGrammars.javascript()
    let parser = Parser()
    _ = parser.setLanguage(lang)
    let mirror = Mirror()
    mirror.setText("let a = 1;\nlet b = 2;\n")
    let tree = try XCTUnwrap(parser.parse(nil, mirror, nil, budgetMicros: 0))
    let query = try Query.compile(lang, "(number) @n")
    let cursor = QueryCursor()
    cursor.exec(query, tree.rootNode)
    cursor.setUnitRange(11, 22)
    var found: [Int] = []
    while let capture = cursor.nextCapture() {
      found.append(capture.node.startUnit)
      XCTAssertEqual(cursor.matchCaptureCount, 1)
      XCTAssertEqual(cursor.matchCapture(0).captureIndex, capture.captureIndex)
    }
    XCTAssertEqual(found, [19])
  }

  func testIncludedRangesFollowEdits() throws {
    let parser = Parser()
    _ = parser.setLanguage(HostGrammars.javascript())
    let mirror = Mirror()
    mirror.setText("aa let x = 1; bb")
    XCTAssertTrue(parser.setIncludedRanges([3, 13, 0, 3, 0, 13]))
    let tree = try XCTUnwrap(parser.parse(nil, mirror, nil, budgetMicros: 0))
    XCTAssertEqual(tree.includedRanges(), [3, 13, 0, 3, 0, 13])
    tree.edit(edit(0, 0, 2))
    XCTAssertEqual(tree.includedRanges(), [5, 15, 0, 5, 0, 15])
  }

  func testChangedRangesCoverTheEditInUnits() throws {
    let parser = Parser()
    _ = parser.setLanguage(HostGrammars.javascript())
    let mirror = Mirror()
    mirror.setText("let a = 1;\nlet b = 2;\n")
    let old = try XCTUnwrap(parser.parse(nil, mirror, nil, budgetMicros: 0))
    // A number becoming a call changes the structure; tree-sitter reports no range for a retyped leaf.
    mirror.replace(8, 9, "f(1)")
    old.edit(edit(8, 9, 12))
    let new = try XCTUnwrap(parser.parse(old, mirror, nil, budgetMicros: 0))
    let r = new.changedRanges(since: old)
    XCTAssertTrue(r.count >= 2 && r.count % 2 == 0)
    XCTAssertLessThanOrEqual(r.first ?? 99, 8)
    XCTAssertGreaterThanOrEqual(r.count > 1 ? r[1] : 0, 12)
    XCTAssertLessThanOrEqual(r.last ?? 99, 14, "units, not bytes")
  }
}
