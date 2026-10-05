import UIKit

class HybridCodeEditorView: HybridCodeEditorViewSpec {
  var view: UIView = UIView()
  var initialValue: String? = nil
  var language: String? = nil
  var theme: NativeTheme? = nil
  var fontFamily: String? = nil
  var fontSize: Double? = nil
  var lineHeight: Double? = nil
  var lineNumbers: Bool? = nil
  var softWrap: Bool? = nil
  var readOnly: Bool? = nil
  var highlightActiveLine: Bool? = nil
  var placeholder: String? = nil
  var contentInsets: NativeInsets? = nil
  var onReady: (() -> Void)? = nil
  var scrollEnabled: Bool? = nil
  var onScroll: ((NativeScrollEvent) -> Void)? = nil
  var onSelectionChange: ((NativeSelection) -> Void)? = nil

  func getText() throws -> String {
    return initialValue ?? ""
  }

  func getLength() throws -> Double {
    return Double((initialValue ?? "").utf16.count)
  }

  func getLineCount() throws -> Double {
    return Double(lines().count)
  }

  func getLine(index: Double) throws -> String {
    let all = lines()
    let i = Int(index)
    return i >= 0 && i < all.count ? String(all[i]) : ""
  }

  func getRevision() throws -> Double {
    return 0
  }

  func setText(text: String, keepHistory: Bool) throws -> Promise<Void> {
    initialValue = text
    return Promise.resolved(withResult: ())
  }

  func getSelection() throws -> NativeSelection {
    return NativeSelection(anchor: 0, head: 0, revision: 0)
  }

  func getTextInRange(start: Double, end: Double) throws -> String {
    return ""
  }

  func offsetToPosition(offset: Double) throws -> NativePosition {
    return NativePosition(line: 0, column: 0)
  }

  func positionToOffset(line: Double, column: Double) throws -> Double {
    return 0
  }

  func getCursorRect() throws -> NativeRect? {
    return nil
  }

  func getVisibleLines() throws -> NativeVisibleLines {
    return NativeVisibleLines(first: 0, last: 0)
  }

  func setSelection(anchor: Double, head: Double) throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func selectAll() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func scrollToLine(line: Double, animated: Bool) throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func revealSelection() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  private func lines() -> [Substring] {
    return (initialValue ?? "").split(separator: "\n", omittingEmptySubsequences: false)
  }
}
