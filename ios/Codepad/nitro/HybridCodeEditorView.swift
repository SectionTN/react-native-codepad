import NitroModules
import UIKit

/// The Nitro view over CodeEditorView: props apply in afterUpdate on the main actor in a fixed order (text once,
/// language, theme and font, flags, settings), sync readers take the core's read lock on the JS thread and write
/// methods hop to main. Props and callbacks are main thread only, which the unchecked Sendable stands on.
final class HybridCodeEditorView: HybridCodeEditorViewSpec, @unchecked Sendable {
  private enum Prop: CaseIterable {
    case text, language, theme, font, lineNumbers, softWrap, readOnly, highlightActiveLine, matchBrackets, placeholder
    case scrollEnabled, contentInsets, avoidKeyboard, suggestions, autoFocus, settings
  }

  private let editor: CodeEditorView
  private var dirty = Set<Prop>()
  private var pendingText: String?
  private var loaded = false

  var view: UIView { editor }

  // The document owns the text after the first load; a second copy of a big file is waste.
  var initialValue: String? {
    get { nil }
    set {
      guard !loaded, let text = newValue else { return }
      pendingText = text
      dirty.insert(.text)
    }
  }

  var language: String? { didSet { dirty.insert(.language) } }
  var theme: NativeTheme? { didSet { dirty.insert(.theme) } }
  var fontFamily: String? { didSet { dirty.insert(.font) } }
  var fontSize: Double? { didSet { dirty.insert(.font) } }
  var lineHeight: Double? { didSet { dirty.insert(.font) } }
  var lineNumbers: Bool? { didSet { dirty.insert(.lineNumbers) } }
  var softWrap: Bool? { didSet { dirty.insert(.softWrap) } }
  var readOnly: Bool? { didSet { dirty.insert(.readOnly) } }
  var highlightActiveLine: Bool? { didSet { dirty.insert(.highlightActiveLine) } }
  var matchBrackets: Bool? { didSet { dirty.insert(.matchBrackets) } }
  var placeholder: String? { didSet { dirty.insert(.placeholder) } }
  var scrollEnabled: Bool? { didSet { dirty.insert(.scrollEnabled) } }
  var contentInsets: NativeInsets? { didSet { dirty.insert(.contentInsets) } }
  var avoidKeyboard: Bool? { didSet { dirty.insert(.avoidKeyboard) } }
  var suggestions: NativeSuggestions? { didSet { dirty.insert(.suggestions) } }
  var autoFocus: Bool? { didSet { dirty.insert(.autoFocus) } }
  var tabSize: Double? { didSet { dirty.insert(.settings) } }
  var insertSpaces: Bool? { didSet { dirty.insert(.settings) } }
  var autoIndent: Bool? { didSet { dirty.insert(.settings) } }
  var autoCloseBrackets: Bool? { didSet { dirty.insert(.settings) } }
  var onReady: (() -> Void)?
  var onScroll: ((NativeScrollEvent) -> Void)?
  var onSelectionChange: ((NativeSelection) -> Void)?
  var onChange: ((NativeChangeEvent) -> Void)?
  var onChangeText: ((String) -> Void)?
  var onEditorFocus: (() -> Void)?
  var onEditorBlur: (() -> Void)?
  var onContentSizeChange: ((NativeContentSize) -> Void)?

  override init() {
    editor = MainActor.assumeIsolated { CodeEditorView() }
    super.init()
    MainActor.assumeIsolated { wire() }
  }

  @MainActor private func wire() {
    editor.onReady = { [weak self] in self?.onReady?() }
    editor.onScroll = { [weak self] f in
      self?.onScroll?(NativeScrollEvent(x: f.scrollX, y: f.scrollY, contentWidth: f.contentWidth, contentHeight: f.contentHeight))
    }
    editor.onSelectionChange = { [weak self] s in
      guard let self else { return }
      let revision = Double(editor.core.document.revision)
      onSelectionChange?(NativeSelection(anchor: Double(s.anchor), head: Double(s.head), revision: revision))
    }
    editor.onContentSizeChange = { [weak self] size in
      self?.onContentSizeChange?(NativeContentSize(width: size.width, height: size.height))
    }
    editor.onChange = { [weak self] change, origin in
      guard let self else { return }
      onChange?(
        NativeChangeEvent(
          start: Double(change.start), end: Double(change.end), text: change.inserted, origin: Self.toOrigin(origin),
          revision: Double(change.revision)))
      onChangeText?(editor.core.document.text())
    }
    editor.onEditorFocus = { [weak self] in self?.onEditorFocus?() }
    editor.onEditorBlur = { [weak self] in self?.onEditorBlur?() }
  }

  // Props

  func afterUpdate() {
    let props = dirty
    dirty = []
    if props.isEmpty { return }
    MainActor.assumeIsolated {
      for prop in Prop.allCases where props.contains(prop) { apply(prop) }
    }
  }

  @MainActor private func apply(_ prop: Prop) {
    switch prop {
    case .text:
      guard let text = pendingText else { return }
      pendingText = nil
      loaded = true
      editor.setInitialText(text)
    case .language: editor.setLanguage(language)
    case .theme: editor.setTheme(theme.map(Self.toColors) ?? .default)
    case .font: editor.setFont(family: fontFamily, size: fontSize ?? 14, lineHeight: lineHeight ?? 1.4)
    case .lineNumbers: editor.setLineNumbers(lineNumbers ?? true)
    case .softWrap: editor.setSoftWrap(softWrap ?? false)
    case .readOnly: editor.setReadOnly(readOnly ?? false)
    case .highlightActiveLine: editor.setHighlightActiveLine(highlightActiveLine ?? true)
    case .matchBrackets: editor.setMatchBrackets(matchBrackets ?? true)
    case .placeholder: editor.setPlaceholder(placeholder)
    case .scrollEnabled: editor.setScrollEnabled(scrollEnabled ?? true)
    case .contentInsets:
      editor.setContentInsets(
        top: contentInsets?.top ?? 0, bottom: contentInsets?.bottom ?? 0, left: contentInsets?.left ?? 0,
        right: contentInsets?.right ?? 0)
    case .avoidKeyboard: editor.setAvoidKeyboard(avoidKeyboard ?? false)
    case .suggestions: editor.setSuggestions(Self.toSuggestions(suggestions))
    case .autoFocus: editor.setAutoFocus(autoFocus ?? false)
    case .settings:
      editor.setEditorSettings(
        EditorSettings(
          tabSize: Self.int(tabSize ?? 4), insertSpaces: insertSpaces ?? true, autoIndent: autoIndent ?? true,
          autoCloseBrackets: autoCloseBrackets ?? true))
    }
  }

  // Sync readers, on the JS thread under the core's read lock

  func getText() throws -> String {
    let core = editor.core
    return core.read { core.document.text() }
  }

  func getLength() throws -> Double {
    let core = editor.core
    return core.read { Double(core.document.length) }
  }

  func getLineCount() throws -> Double {
    let core = editor.core
    return core.read { Double(core.document.lineCount) }
  }

  func getLine(index: Double) throws -> String {
    let core = editor.core
    return core.read { core.document.lineString(Self.int(index)) }
  }

  func getRevision() throws -> Double {
    let core = editor.core
    return core.read { Double(core.document.revision) }
  }

  func getSelection() throws -> NativeSelection {
    let core = editor.core
    return core.read {
      let s = core.selection
      return NativeSelection(anchor: Double(s.anchor), head: Double(s.head), revision: Double(core.document.revision))
    }
  }

  func getTextInRange(start: Double, end: Double) throws -> String {
    let core = editor.core
    return core.read { core.document.text(Self.int(start), Self.int(end)) }
  }

  func offsetToPosition(offset: Double) throws -> NativePosition {
    let core = editor.core
    return core.read {
      let p = core.document.offsetToPosition(Self.int(offset))
      return NativePosition(line: Double(p.line), column: Double(p.column))
    }
  }

  func positionToOffset(line: Double, column: Double) throws -> Double {
    let core = editor.core
    return core.read { Double(core.document.positionToOffset(line: Self.int(line), column: Self.int(column))) }
  }

  // Both read the frame the main thread published after its last layout.
  func getCursorRect() throws -> NativeRect? {
    editor.latestFrame.caret.map { NativeRect(x: $0.minX, y: $0.minY, width: $0.width, height: $0.height) }
  }

  func getVisibleLines() throws -> NativeVisibleLines {
    let frame = editor.latestFrame
    return NativeVisibleLines(first: Double(frame.firstLine), last: Double(frame.lastLine))
  }

  func isFocused() throws -> Bool {
    editor.hasFocus
  }

  // Stack sizes read without the lock, a benign race like the selection.
  func canUndo() throws -> Bool {
    editor.core.canUndo
  }

  func canRedo() throws -> Bool {
    editor.core.canRedo
  }

  // Write methods

  func setText(text: String, keepHistory: Bool) throws -> Promise<Void> {
    onMain { $0.setText(text, keepHistory: keepHistory) }
  }

  func setSelection(anchor: Double, head: Double) throws -> Promise<Void> {
    let (a, h) = (Self.int(anchor), Self.int(head))
    return onMain { $0.core.setSelection(anchor: a, head: h) }
  }

  func selectAll() throws -> Promise<Void> {
    onMain { $0.selectAll() }
  }

  func scrollToLine(line: Double, animated: Bool) throws -> Promise<Void> {
    let l = Self.int(line)
    return onMain { $0.scrollToLine(l, animated: animated) }
  }

  func revealSelection() throws -> Promise<Void> {
    onMain { $0.revealSelection() }
  }

  func insertText(text: String) throws -> Promise<Void> {
    onMain { $0.core.insertText(text) }
  }

  func replaceRange(start: Double, end: Double, text: String) throws -> Promise<Void> {
    let (s, e) = (Self.int(start), Self.int(end))
    return onMain { _ = $0.core.replace(s, e, text) }
  }

  func undo() throws -> Promise<Void> {
    onMain { $0.undo() }
  }

  func redo() throws -> Promise<Void> {
    onMain { $0.redo() }
  }

  func indent() throws -> Promise<Void> {
    onMain { $0.core.indent() }
  }

  func outdent() throws -> Promise<Void> {
    onMain { $0.core.outdent() }
  }

  func cut() throws -> Promise<Void> {
    onMain { $0.cut(origin: .api) }
  }

  func copy() throws -> Promise<Void> {
    onMain { _ = $0.copySelection() }
  }

  func paste() throws -> Promise<Void> {
    onMain { $0.paste(origin: .api) }
  }

  func focus() throws -> Promise<Void> {
    onMain { $0.focus() }
  }

  func blur() throws -> Promise<Void> {
    onMain { $0.blur() }
  }

  // Search methods resolve once the worker's results match the document.

  func setSearch(query: NativeSearchQuery) throws -> Promise<Double> {
    let q = SearchQuery(text: query.text, regex: query.regex, caseSensitive: query.caseSensitive, wholeWord: query.wholeWord)
    return deferred { editor, promise in
      try editor.setSearch(q)
      editor.whenSearchFresh { promise.resolve(withResult: Double(editor.matchCount)) }
    }
  }

  func findNext() throws -> Promise<NativeSearchHit> {
    deferred { editor, promise in
      editor.whenSearchFresh { promise.resolve(withResult: Self.toHit(editor.findNext())) }
    }
  }

  func findPrevious() throws -> Promise<NativeSearchHit> {
    deferred { editor, promise in
      editor.whenSearchFresh { promise.resolve(withResult: Self.toHit(editor.findPrevious())) }
    }
  }

  func replaceCurrent(text: String) throws -> Promise<Bool> {
    deferred { editor, promise in
      editor.whenSearchFresh { promise.resolve(withResult: editor.replaceCurrent(text)) }
    }
  }

  func replaceAll(text: String) throws -> Promise<Double> {
    deferred { editor, promise in
      editor.whenSearchFresh { promise.resolve(withResult: Double(editor.replaceAll(text))) }
    }
  }

  func clearSearch() throws -> Promise<Void> {
    onMain { $0.clearSearch() }
  }

  func moveCaret(direction: NativeCaretDirection, select: Bool) throws -> Promise<Void> {
    let command = Self.toCommand(direction, select)
    return onMain { $0.perform(command) }
  }

  func typeText(text: String) throws -> Promise<Void> {
    onMain { $0.typeText(text) }
  }

  func deleteBackward() throws -> Promise<Void> {
    onMain { $0.perform(.backspace) }
  }

  func deleteForward() throws -> Promise<Void> {
    onMain { $0.perform(.delete) }
  }

  // Helpers

  /// Runs `block` on the main actor with the promise it must settle; a thrown error rejects it.
  private func deferred<T>(_ block: @escaping @Sendable @MainActor (CodeEditorView, Promise<T>) throws -> Void) -> Promise<T> {
    let promise = Promise<T>()
    let editor = editor
    editor.runOnMain {
      do {
        try block(editor, promise)
      } catch {
        promise.reject(withError: error)
      }
    }
    return promise
  }

  /// Write methods run on the main actor and resolve once the change is applied and a frame is queued.
  private func onMain(_ block: @escaping @Sendable @MainActor (CodeEditorView) -> Void) -> Promise<Void> {
    deferred { editor, promise in
      block(editor)
      editor.setNeedsLayout()
      promise.resolve()
    }
  }

  /// JS numbers clamp into the Int32 range so an offset no document can hold never traps the conversion.
  private static func int(_ value: Double) -> Int {
    value.isNaN ? 0 : Int(max(Double(Int32.min), min(value, Double(Int32.max))))
  }

  private static func toCommand(_ direction: NativeCaretDirection, _ select: Bool) -> KeyCommand {
    switch direction {
    case .left: .move(unit: .char, forward: false, extend: select)
    case .right: .move(unit: .char, forward: true, extend: select)
    case .wordleft: .move(unit: .word, forward: false, extend: select)
    case .wordright: .move(unit: .word, forward: true, extend: select)
    case .linestart: .move(unit: .lineStart, forward: false, extend: select)
    case .lineend: .move(unit: .lineEnd, forward: true, extend: select)
    case .documentstart: .move(unit: .docStart, forward: false, extend: select)
    case .documentend: .move(unit: .docEnd, forward: true, extend: select)
    case .up: .vertical(direction: -1, page: false, extend: select)
    case .down: .vertical(direction: 1, page: false, extend: select)
    case .pageup: .vertical(direction: -1, page: true, extend: select)
    case .pagedown: .vertical(direction: 1, page: true, extend: select)
    }
  }

  private static func toHit(_ hit: EditorCore.SearchHit?) -> NativeSearchHit {
    NativeSearchHit(index: Double(hit?.index ?? -1), total: Double(hit?.total ?? 0))
  }

  private static func toOrigin(_ origin: ChangeOrigin) -> NativeChangeOrigin {
    switch origin {
    case .input: .input
    case .api: .api
    case .undo: .undo
    case .redo: .redo
    }
  }

  private static func toSuggestions(_ value: NativeSuggestions?) -> Suggestions {
    switch value {
    case .forceoff: .forceOff
    case .on: .on
    default: .off
    }
  }

  /// A color the theme cannot parse falls back to the default theme's, so a typo never blanks the editor.
  private static func toColors(_ t: NativeTheme) -> ThemeColors {
    let base = ThemeColors.default
    func color(_ css: String, _ fallback: CGColor) -> CGColor { ThemeColors.parse(css: css) ?? fallback }
    var tokens: [String: TokenStyle] = [:]
    for (key, style) in t.tokens {
      tokens[key] = TokenStyle(color: color(style.color, base.foreground), bold: style.bold, italic: style.italic)
    }
    return ThemeColors(
      background: color(t.background, base.background), foreground: color(t.foreground, base.foreground),
      gutterBackground: color(t.gutterBackground, base.gutterBackground),
      gutterForeground: color(t.gutterForeground, base.gutterForeground),
      gutterActiveForeground: color(t.gutterActiveForeground, base.gutterActiveForeground),
      activeLine: color(t.activeLine, base.activeLine), selection: color(t.selection, base.selection),
      cursor: color(t.cursor, base.cursor), matchingBracket: color(t.matchingBracket, base.matchingBracket),
      searchMatch: color(t.searchMatch, base.searchMatch),
      searchMatchActive: color(t.searchMatchActive, base.searchMatchActive), tokens: tokens)
  }
}
