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

  // Created and attached by the first layout op. The core keeps its rows and gaps in step with the edits.
  private var viewport: Viewport? = nil
  private var anchor: Viewport.Anchor? = nil
  private var widthChanged = false

  init(_ testCase: [String: Any]) {
    self.testCase = testCase
    let clock = Clock()
    self.clock = clock
    core = EditorCore(testCase["text"] as? String ?? "", clock: { clock.now })
    core.onChange = { [weak self] change, origin in self?.changes.append((change, origin)) }
  }

  private func layout(_ op: [String: Any]) {
    let vp: Viewport
    if let existing = viewport {
      vp = existing
    } else {
      vp = Viewport()
      vp.attach(core)
      viewport = vp
    }
    let before = vp.textAreaWidth
    let insets = op["insets"] as? [Int] ?? [0, 0, 0, 0]
    vp.rowHeight = int(op, "rowHeight")
    vp.gutterWidth = int(op, "gutter")
    vp.textPadding = int(op, "padding")
    vp.wrap = bool(op, "wrap", false)
    _ = vp.resize(width: int(op, "width"), height: int(op, "height"))
    _ = vp.setInsets(top: insets[0], bottom: insets[1], left: insets[2], right: insets[3])
    widthChanged = vp.textAreaWidth != before
  }

  func run() {
    // A pending case pins behavior the engine does not have yet.
    if let pending = testCase["pending"] as? String, !pending.isEmpty {
      print("pending (\(pending)): \(testCase["name"] as? String ?? "")")
      return
    }
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
    case "bracketMatch": lastResult = core.bracketMatch(snapshot: nil)
    case "search":
      do {
        try core.setSearch(
          SearchQuery(
            text: string(op, "text"), regex: bool(op, "regex", false), caseSensitive: bool(op, "caseSensitive", false),
            wholeWord: bool(op, "wholeWord", false)))
        core.ensureMatches()
        lastResult = core.matchCount
      } catch {
        lastError = (error as? SearchError)?.message ?? "invalid"
      }
    case "findNext": lastResult = core.findNext()
    case "findPrevious": lastResult = core.findPrevious()
    case "replaceCurrent": lastResult = core.replaceCurrent(string(op, "text"))
    case "replaceAll": lastResult = core.replaceAll(string(op, "text"))
    case "clearSearch": core.clearSearch()
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
    case "decorate":
      let items = (op["items"] as? [[String: Any]] ?? []).map(decorationOf)
      _ = core.setDecorations(items, revision: op["revision"] as? Int ?? -1)
    case "layout": layout(op)
    case "measure":
      guard let vp = viewport else { return XCTFail("measure before layout") }
      for pair in op["pairs"] as? [[Int]] ?? [] { vp.measured(pair[0], pair[1]) }
      if let widest = op["widest"] as? Int, !vp.wrap { vp.widestLine = max(vp.widestLine, widest) }
    case "scrollTo":
      if let vp = viewport { lastResult = vp.scrollTo(int(op, "x"), int(op, "y")) }
    case "scrollBy":
      if let vp = viewport { lastResult = vp.scrollTo(vp.scrollX + int(op, "dx"), vp.scrollY + int(op, "dy")) }
    case "reveal":
      if let vp = viewport {
        lastResult = vp.reveal(left: int(op, "left"), top: int(op, "top"), right: int(op, "right"), bottom: int(op, "bottom"))
      }
    case "anchor": anchor = viewport?.anchor()
    case "restore": if let a = anchor { viewport?.restore(a) }
    case "resetRows": viewport?.resetRows()
    default: XCTFail("op not implemented: \(name)")
    }
  }

  private func decorationOf(_ o: [String: Any]) -> Decoration {
    switch string(o, "kind") {
    case "underline":
      let thickness = (o["thickness"] as? NSNumber)?.doubleValue ?? 1
      return .underline(Underline(start: int(o, "start"), end: int(o, "end"), color: 0, style: .solid, thickness: thickness, offset: 2))
    case "gap": return .gap(line: int(o, "line"), rows: int(o, "rows"))
    case "lineBackground": return .lineBackground(line: int(o, "line"), color: 0)
    default: fatalError("unknown decoration kind \(string(o, "kind"))")
    }
  }

  // Only what mapping changes: kind and range, or kind, line and rows.
  private func describe(_ d: Decoration) -> String {
    switch d {
    case .underline(let u): return "underline \(u.start) \(u.end)"
    case .gap(let line, let rows): return "gap \(line) \(rows)"
    case .lineBackground(let line, _): return "lineBackground \(line)"
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
    if let arr = expect["decorations"] as? [[String: Any]] {
      XCTAssertEqual(core.decorations.items.map(describe), arr.map { describe(decorationOf($0)) }, "decorations \(at)")
    }
    if let o = expect["gapRows"] as? [String: Int] {
      var expected: [Int: Int] = [:]
      for (k, v) in o { expected[Int(k)!] = v }
      XCTAssertEqual(core.decorations.gapRows(), expected, "gapRows \(at)")
    }
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
    if let arr = expect["matches"] as? [[Int]] {
      XCTAssertEqual(core.matches, arr.flatMap { $0 }, "matches \(at)")
    }
    if expect.keys.contains("found") {
      if let f = expect["found"] as? [String: Any] {
        XCTAssertEqual(
          lastResult as? EditorCore.SearchHit, EditorCore.SearchHit(index: int(f, "index"), total: int(f, "total")),
          "found \(at)")
      } else {
        XCTAssertNil(lastResult as? EditorCore.SearchHit, "found \(at)")
      }
    }
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
    checkLayout(expect, at)
  }

  private func checkLayout(_ expect: [String: Any], _ at: String) {
    guard let vp = viewport else { return }
    let h = vp
    if let v = expect["widthChanged"] as? Bool { XCTAssertEqual(widthChanged, v, "widthChanged \(at)") }
    if let v = expect["scroll"] as? [Int] { XCTAssertEqual([vp.scrollX, vp.scrollY], v, "scroll \(at)") }
    if let v = expect["maxScroll"] as? [Int] { XCTAssertEqual([vp.maxScrollX, vp.maxScrollY], v, "maxScroll \(at)") }
    if let v = expect["content"] as? [Int] { XCTAssertEqual([vp.contentWidth, vp.contentHeight], v, "content \(at)") }
    if let v = expect["visible"] as? [Int] { XCTAssertEqual([vp.firstVisibleLine(), vp.lastVisibleLine()], v, "visible \(at)") }
    if let v = expect["totalRows"] as? Int { XCTAssertEqual(h.totalRows, v, "totalRows \(at)") }
    for (k, v) in expect["rowStart"] as? [String: Int] ?? [:] { XCTAssertEqual(h.rowStart(Int(k)!), v, "rowStart \(k) \(at)") }
    for (k, v) in expect["lineAtRow"] as? [String: Int] ?? [:] { XCTAssertEqual(h.lineAtRow(Int(k)!), v, "lineAtRow \(k) \(at)") }
    for (k, v) in expect["isGapRow"] as? [String: Bool] ?? [:] { XCTAssertEqual(h.isGapRow(Int(k)!), v, "isGapRow \(k) \(at)") }
    for (k, v) in expect["lineTop"] as? [String: Int] ?? [:] { XCTAssertEqual(vp.lineTop(Int(k)!), v, "lineTop \(k) \(at)") }
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
