import XCTest

@testable import Codepad

@MainActor
final class HitTestTests: XCTestCase {
  func testPointsMapBackToTheOffsetsTheyWereDrawnAt() {
    let editor = launch()
    editor.setLineNumbers(false)
    editor.setInitialText("abcdef\n" + String(repeating: "x", count: 80))
    for wrap in [false, true] {
      editor.setSoftWrap(wrap)
      layout(editor)
      for offset in [0, 3, 6, 7, 40, 87] {
        editor.core.setSelection(anchor: offset, head: offset)
        draw(editor)
        guard let caret = editor.latestFrame.caret else {
          XCTFail("no caret rect at \(offset)")
          return
        }
        XCTAssertEqual(editor.offsetAt(x: caret.minX + 2, y: caret.midY), offset, "wrap \(wrap) offset \(offset)")
      }
      editor.core.setSelection(anchor: 0, head: 0)
      draw(editor)
      guard let caret = editor.latestFrame.caret else {
        XCTFail("no caret")
        return
      }
      let row0 = caret.minY + 2
      XCTAssertEqual(editor.offsetAt(x: 299, y: row0), 6, "wrap \(wrap) far right")
      XCTAssertEqual(editor.offsetAt(x: 0, y: row0), 0, "wrap \(wrap) far left")
      // The wrapped rows can outgrow the view, so probe just past the content, not a fixed y.
      let below = editor.latestFrame.contentHeight + 10
      XCTAssertEqual(editor.offsetAt(x: 150, y: below), editor.core.document.length, "wrap \(wrap) below")
    }
  }

  func testTextPaddingMovesTheTextAndItsHitTest() {
    let editor = launch()
    editor.setLineNumbers(false)
    editor.setContentInsets(top: 0, bottom: 0, left: 11, right: 0)
    editor.setInitialText("abc\ndef")
    layout(editor)
    XCTAssertEqual(caretX(editor), 19, "unset")
    editor.setTextPadding(0)
    XCTAssertEqual(caretX(editor), 11, "zero")
    XCTAssertEqual(editor.caretRect(offset: 0).minX, 0)
    XCTAssertEqual(editor.offsetAt(contentPoint: CGPoint(x: editor.caretRect(offset: 2).minX + 1, y: 1)), 2)
    XCTAssertEqual(editor.offsetAt(x: 12, y: editor.latestFrame.caret?.midY ?? 0), 0)
    XCTAssertTrue(lineLayers(editor).allSatisfy { $0.padding == 0 }, "line layers")
    editor.setTextPadding(10.6)
    XCTAssertEqual(caretX(editor), 22, "rounded like the viewport")
    editor.setTextPadding(-4)
    XCTAssertEqual(caretX(editor), 11, "clamped")
    editor.setTextPadding(8)
    editor.setInitialText("")
    editor.setPlaceholder("hint")
    layout(editor)
    draw(editor)
    editor.setTextPadding(0)
    draw(editor)
    XCTAssertFalse(lineLayers(editor).isEmpty)
    XCTAssertTrue(lineLayers(editor).allSatisfy { $0.padding == 0 }, "placeholder layer")
  }

  func testTheCaretViewFollowsATextPaddingChange() {
    let editor = launch()
    editor.setLineNumbers(false)
    editor.setInitialText("abc")
    layout(editor)
    editor.focus()
    draw(editor)
    let cursor = editor.textInput.cursorView
    spin(until: { cursor.frame.minX == editor.caretRect(offset: 0).minX })
    XCTAssertEqual(cursor.frame.minX, 8, "unset")
    editor.setTextPadding(0)
    draw(editor)
    spin(until: { cursor.frame.minX == 0 })
    XCTAssertEqual(cursor.frame.minX, 0, "padding only")
    editor.setTextPadding(8)
    draw(editor)
    spin(until: { cursor.frame.minX == 8 })
    editor.setFont(family: nil, size: 20, lineHeight: 1.4)
    editor.setContentInsets(top: 0, bottom: 0, left: 13, right: 0)
    editor.setTextPadding(0)
    layout(editor)
    draw(editor)
    spin(until: { cursor.frame.minX == 0 })
    XCTAssertEqual(cursor.frame.minX, 0, "font, insets and padding in one batch")
  }

  func testATextPaddingChangeKeepsTheFocusedCaretInView() {
    let editor = launch()
    editor.setLineNumbers(false)
    editor.setInitialText(String(repeating: "x", count: 80))
    layout(editor)
    editor.focus()
    editor.core.setSelection(anchor: 80, head: 80)
    draw(editor)
    editor.setTextPadding(40)
    draw(editor)
    guard let caret = editor.latestFrame.caret else {
      XCTFail("no caret")
      return
    }
    XCTAssertLessThanOrEqual(caret.maxX, editor.bounds.width, "caret \(caret)")
  }

  private func caretX(_ editor: CodeEditorView) -> CGFloat? {
    editor.core.setSelection(anchor: 0, head: 0)
    draw(editor)
    return editor.latestFrame.caret?.minX
  }

  private func lineLayers(_ editor: CodeEditorView) -> [LineLayer] {
    editor.textInput.textHost.sublayers?.compactMap { $0 as? LineLayer } ?? []
  }

  func testATouchBelowTheLastLineReachesTheTextView() {
    let editor = launch()
    editor.setInitialText("one\ntwo")
    layout(editor)
    draw(editor)
    let below = CGPoint(x: 150, y: editor.latestFrame.contentHeight + 40)
    let hit = editor.hitTest(below, with: nil)
    XCTAssertTrue(hit?.isDescendant(of: editor.textInput) ?? false, "hit \(String(describing: hit))")
  }

  func testTapInAGapLeavesTheCaret() {
    let editor = launch()
    editor.setInitialText((0..<6).map { "line \($0)" }.joined(separator: "\n"))
    layout(editor)
    editor.setDecorations([.gap(line: 1, rows: 2)], revision: -1)
    draw(editor)
    guard let g = editor.gapRect(line: 1) else { return XCTFail("no gap rect") }
    // The machine the editor's recognizer feeds, driven with the text view as its host.
    let machine = GestureMachine(
      host: editor.textInput, config: GestureMachine.Config(touchSlop: 8, doubleTapSlop: 40, doubleTapTimeout: 0.3, longPressTimeout: 0.4))
    editor.core.setSelection(anchor: 3, head: 3)
    machine.down(x: g.midX, y: g.midY, time: 0)
    machine.up(x: g.midX, y: g.midY, time: 0.05)
    XCTAssertEqual(editor.core.selection, Selection(anchor: 3, head: 3))
    // The row right under the gap is line 2, and a tap there still moves the caret.
    machine.down(x: 20, y: g.maxY + 2, time: 1)
    machine.up(x: 20, y: g.maxY + 2, time: 1.05)
    XCTAssertEqual(editor.core.document.lineAt(editor.core.selection.head), 2)
  }
}
