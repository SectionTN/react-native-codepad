import Foundation
import XCTest

@testable import Codepad

/// Line for line port of the Kotlin VectorRunner: the same ops, the same expect keys, the same messages.
final class VectorRunner {
  private final class Clock {
    var now: Int64 = 0
  }

  private let testCase: [String: Any]
  private let clock: Clock
  private let core: EditorCore
  private var changes: [(Change, ChangeOrigin)] = []
  private var lastResult: Any? = nil
  private var lastError: String? = nil

  init(_ testCase: [String: Any]) {
    self.testCase = testCase
    let clock = Clock()
    self.clock = clock
    core = EditorCore(testCase["text"] as? String ?? "", clock: { clock.now })
    core.onChange = { [weak self] change, origin in self?.changes.append((change, origin)) }
  }

  func run() {
    let ops = testCase["ops"] as? [[String: Any]] ?? []
    for (i, op) in ops.enumerated() {
      lastResult = nil
      lastError = nil
      apply(op)
      if let expect = op["expect"] as? [String: Any] {
        check(expect, "after op \(i + 1) (\(string(op, "op")))")
      }
    }
    if let expect = testCase["expect"] as? [String: Any] { check(expect, "at end") }
  }

  private func apply(_ op: [String: Any]) {
    let name = string(op, "op")
    switch name {
    case "replace": core.replace(int(op, "start"), int(op, "end"), string(op, "text"))
    case "setSelection": core.setSelection(anchor: int(op, "anchor"), head: int(op, "head"))
    case "selectAll": core.selectAll()
    case "move": core.move(unitOf(string(op, "unit")), forward: int(op, "dir") > 0, extend: bool(op, "extend", false))
    case "selectWord": core.selectWordAt(int(op, "offset"))
    case "type": core.typeText(string(op, "text"))
    case "insertText": core.insertText(string(op, "text"))
    case "setText": core.setText(string(op, "text"), keepHistory: bool(op, "keepHistory", false))
    case "backspace": core.backspace()
    case "delete": core.delete()
    case "undo": lastResult = core.undo()
    case "redo": lastResult = core.redo()
    case "enter": core.insertNewline()
    case "tab": core.tab()
    case "shiftTab": core.shiftTab()
    case "indent": core.indent()
    case "outdent": core.outdent()
    case "bracketMatch": lastResult = core.bracketMatch(skip: nil)
    case "search", "findNext", "findPrevious", "replaceCurrent", "replaceAll", "clearSearch":
      XCTFail("search is not ported yet: \(name)")
    case "config":
      core.settings = EditorSettings(
        tabSize: op["tabSize"] as? Int ?? core.settings.tabSize,
        insertSpaces: op["insertSpaces"] as? Bool ?? core.settings.insertSpaces,
        autoIndent: op["autoIndent"] as? Bool ?? core.settings.autoIndent,
        autoCloseBrackets: op["autoCloseBrackets"] as? Bool ?? core.settings.autoCloseBrackets
      )
    case "offsetToPosition": lastResult = core.document.offsetToPosition(int(op, "offset"))
    case "positionToOffset": lastResult = core.document.positionToOffset(line: int(op, "line"), column: int(op, "column"))
    case "getLine": lastResult = core.document.lineString(int(op, "index"))
    case "wait": clock.now += Int64(int(op, "ms"))
    default: XCTFail("op not implemented: \(name)")
    }
  }

  private func unitOf(_ name: String) -> TextMovement.Unit {
    switch name {
    case "char": return .char
    case "word": return .word
    case "lineStart": return .lineStart
    case "lineEnd": return .lineEnd
    case "docStart": return .docStart
    case "docEnd": return .docEnd
    default: fatalError("unknown unit \(name)")
    }
  }

  private func check(_ expect: [String: Any], _ at: String) {
    let doc = core.document
    if let v = expect["text"] as? String { XCTAssertEqual(doc.text(), v, "text \(at)") }
    if let v = expect["length"] as? Int { XCTAssertEqual(doc.length, v, "length \(at)") }
    if let v = expect["lineCount"] as? Int { XCTAssertEqual(doc.lineCount, v, "lineCount \(at)") }
    if let v = expect["revision"] as? Int { XCTAssertEqual(doc.revision, v, "revision \(at)") }
    if let s = expect["selection"] as? [String: Any] {
      XCTAssertEqual(core.selection, Selection(anchor: int(s, "anchor"), head: int(s, "head")), "selection \(at)")
    }
    if let p = expect["position"] as? [String: Any] {
      XCTAssertEqual(lastResult as? Position, Position(line: int(p, "line"), column: int(p, "column")), "position \(at)")
    }
    if let v = expect["canUndo"] as? Bool { XCTAssertEqual(core.canUndo, v, "canUndo \(at)") }
    if let v = expect["canRedo"] as? Bool { XCTAssertEqual(core.canRedo, v, "canRedo \(at)") }
    if let v = expect["offset"] as? Int { XCTAssertEqual(lastResult as? Int, v, "offset \(at)") }
    if let v = expect["line"] as? String { XCTAssertEqual(lastResult as? String, v, "line \(at)") }
    if expect["matches"] != nil { XCTFail("matches is not ported yet \(at)") }
    if expect.keys.contains("found") { XCTFail("found is not ported yet \(at)") }
    if let v = expect["result"] { checkResult(v, at) }
    if expect.keys.contains("brackets") {
      if expect["brackets"] is NSNull {
        XCTAssertNil(lastResult, "brackets \(at)")
      } else {
        let arr = expect["brackets"] as? [Int] ?? []
        let got = (lastResult as? (Int, Int)).map { [$0.0, $0.1] }
        XCTAssertEqual(got, arr, "brackets \(at)")
      }
    }
    if let list = expect["changes"] as? [[String: Any]] {
      XCTAssertEqual(changes.count, list.count, "change count \(at)")
      for (i, e) in list.enumerated() where i < changes.count {
        let (c, origin) = changes[i]
        XCTAssertEqual(c.start, int(e, "start"), "change \(i) start \(at)")
        XCTAssertEqual(c.end, int(e, "end"), "change \(i) end \(at)")
        XCTAssertEqual(c.inserted, string(e, "text"), "change \(i) text \(at)")
        XCTAssertEqual(origin.rawValue, string(e, "origin"), "change \(i) origin \(at)")
      }
    }
    if let v = expect["error"] as? Bool {
      if v {
        XCTAssertNotNil(lastError, "error expected \(at)")
      } else {
        XCTAssertNil(lastError, "no error expected \(at)")
      }
    }
  }

  // JSON booleans and integers both arrive as NSNumber; only a CFBoolean compares as a Bool.
  private func checkResult(_ expected: Any, _ at: String) {
    if let n = expected as? NSNumber, CFGetTypeID(n) == CFBooleanGetTypeID() {
      XCTAssertEqual(lastResult as? Bool, n.boolValue, "result \(at)")
    } else if let n = expected as? Int {
      XCTAssertEqual(lastResult as? Int, n, "result \(at)")
    } else {
      XCTFail("result \(at): unsupported expectation \(expected)")
    }
  }

  private func int(_ o: [String: Any], _ key: String) -> Int {
    guard let v = o[key] as? Int else {
      XCTFail("missing int \(key)")
      return 0
    }
    return v
  }

  private func string(_ o: [String: Any], _ key: String) -> String {
    guard let v = o[key] as? String else {
      XCTFail("missing string \(key)")
      return ""
    }
    return v
  }

  private func bool(_ o: [String: Any], _ key: String, _ fallback: Bool) -> Bool {
    o[key] as? Bool ?? fallback
  }
}
