import UIKit
import NitroModules

class HybridCodeEditorView: HybridCodeEditorViewSpec {
  // Nitro creates the hybrid on the main thread; the view is read from the JS thread through this object.
  nonisolated(unsafe) var view: UIView
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
  var matchBrackets: Bool? = nil
  var placeholder: String? = nil
  var contentInsets: NativeInsets? = nil
  var avoidKeyboard: Bool? = nil
  var onReady: (() -> Void)? = nil
  var scrollEnabled: Bool? = nil
  var onScroll: ((NativeScrollEvent) -> Void)? = nil
  var onSelectionChange: ((NativeSelection) -> Void)? = nil
  var suggestions: NativeSuggestions? = nil
  var autoFocus: Bool? = nil
  var tabSize: Double? = nil
  var insertSpaces: Bool? = nil
  var autoIndent: Bool? = nil
  var autoCloseBrackets: Bool? = nil
  var onChange: ((NativeChangeEvent) -> Void)? = nil
  var onChangeText: ((String) -> Void)? = nil
  var onEditorFocus: (() -> Void)? = nil
  var onEditorBlur: (() -> Void)? = nil
  var onContentSizeChange: ((NativeContentSize) -> Void)? = nil

  override init() {
    view = MainActor.assumeIsolated { UIView() }
    super.init()
  }

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

  func isFocused() throws -> Bool {
    return false
  }

  func canUndo() throws -> Bool {
    return false
  }

  func canRedo() throws -> Bool {
    return false
  }

  func insertText(text: String) throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func replaceRange(start: Double, end: Double, text: String) throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func undo() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func redo() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func indent() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func outdent() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func cut() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func copy() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func paste() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func focus() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func blur() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func setSearch(query: NativeSearchQuery) throws -> Promise<Double> {
    return Promise.resolved(withResult: 0)
  }

  func findNext() throws -> Promise<NativeSearchHit> {
    return Promise.resolved(withResult: NativeSearchHit(index: -1, total: 0))
  }

  func findPrevious() throws -> Promise<NativeSearchHit> {
    return Promise.resolved(withResult: NativeSearchHit(index: -1, total: 0))
  }

  func replaceCurrent(text: String) throws -> Promise<Bool> {
    return Promise.resolved(withResult: false)
  }

  func replaceAll(text: String) throws -> Promise<Double> {
    return Promise.resolved(withResult: 0)
  }

  func moveCaret(direction: NativeCaretDirection, select: Bool) throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func typeText(text: String) throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func deleteBackward() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func deleteForward() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  func clearSearch() throws -> Promise<Void> {
    return Promise.resolved(withResult: ())
  }

  private func lines() -> [Substring] {
    return (initialValue ?? "").split(separator: "\n", omittingEmptySubsequences: false)
  }
}
