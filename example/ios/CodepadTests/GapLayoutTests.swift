import XCTest

@testable import Codepad

@MainActor
final class GapLayoutTests: XCTestCase {
  private let text = (0..<6).map { "line \($0)" }.joined(separator: "\n")

  // Caret rects span the whole row, so their top is the row top.
  private func caretTop(_ editor: CodeEditorView, line: Int) -> CGFloat {
    let offset = editor.core.document.lineStart(line)
    editor.core.setSelection(anchor: offset, head: offset)
    draw(editor)
    return editor.latestFrame.caret?.minY ?? .nan
  }

  private func rowHeight(_ editor: CodeEditorView) -> CGFloat {
    draw(editor)
    return editor.latestFrame.caret?.height ?? .nan
  }

  func testGapsPushLaterLinesDownByWholeRows() {
    let editor = launch()
    editor.setLineNumbers(false)
    editor.setInitialText(text)
    layout(editor)
    let rh = rowHeight(editor)
    editor.setDecorations([.gap(line: 1, rows: 2)], revision: -1)
    let top1 = caretTop(editor, line: 1)
    let top2 = caretTop(editor, line: 2)
    XCTAssertEqual(top2 - top1, 3 * rh, accuracy: 0.01)
    guard let g = editor.gapRect(line: 1) else { return XCTFail("no gap rect") }
    XCTAssertEqual(g.minY, top1 + rh, accuracy: 0.01)
    XCTAssertEqual(g.height, 2 * rh, accuracy: 0.01)
    XCTAssertEqual(g.width, editor.bounds.width, accuracy: 0.01)
  }

  func testListenerReportsMovesAndRemovals() {
    let editor = launch()
    editor.setInitialText(text)
    layout(editor)
    let rh = rowHeight(editor)
    var events: [[GapRect]] = []
    editor.onGapLayout = { events.append($0) }
    editor.setDecorations([.gap(line: 2, rows: 1)], revision: -1)
    draw(editor)
    XCTAssertEqual(events.count, 1)
    guard let first = events.first?.first else { return XCTFail("no gap reported") }
    XCTAssertEqual(first.line, 2)
    editor.core.replace(0, 0, "\n")
    draw(editor)
    XCTAssertEqual(events.count, 2)
    XCTAssertEqual(events.last?.first?.line, 3)
    XCTAssertEqual(events.last?.first?.rect.minY ?? .nan, first.rect.minY + rh, accuracy: 0.01)
    draw(editor)
    XCTAssertEqual(events.count, 2, "no event without a change")
    let doc = editor.core.document
    editor.core.replace(doc.lineStart(3), doc.lineStart(4), "")
    draw(editor)
    XCTAssertEqual(events.count, 3)
    XCTAssertEqual(events.last?.isEmpty, true)
  }

  func testArrowDownSkipsTheGap() {
    let editor = launch()
    editor.setInitialText(text)
    layout(editor)
    editor.setDecorations([.gap(line: 1, rows: 2)], revision: -1)
    let start = editor.core.document.lineStart(1)
    editor.core.setSelection(anchor: start, head: start)
    draw(editor)
    editor.perform(.vertical(direction: 1, page: false, extend: false))
    XCTAssertEqual(editor.core.document.lineAt(editor.core.selection.head), 2)
  }
}
