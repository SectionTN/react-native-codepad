import UIKit

enum Suggestions {
  case off
  case forceOff
  case on
}

/// The scroll view's content: the decoration layers, the selection container, the recycled line layers and the
/// marked text underline. UITextInput over the editor's UTF-16 offsets, the composition through the session.
final class TextInputView: UIView, UITextInput, UITextSelectionDisplayInteractionDelegate {
  let decorations = Decorations()
  let selectionContainer = UIView()
  let textHost = StillLayer()
  let markedUnderline = StillShapeLayer()
  let highlightView = HighlightView()
  let cursorView = CursorView()
  let handleViews = [HandleView(), HandleView()]
  private(set) var selectionInteraction: UITextSelectionDisplayInteraction!
  weak var editor: CodeEditorView?
  var session: MarkedTextSession
  private let emptyInputView = UIView(frame: .zero)

  var isReadOnly = false {
    didSet {
      cursorView.readOnly = isReadOnly
      if isFirstResponder { reloadInputViews() }
    }
  }

  weak var inputDelegate: (any UITextInputDelegate)?
  lazy var tokenizer: any UITextInputTokenizer = UITextInputStringTokenizer(textInput: self)
  var markedTextStyle: [NSAttributedString.Key: Any]?
  var autocorrectionType: UITextAutocorrectionType = .no
  var spellCheckingType: UITextSpellCheckingType = .no
  var autocapitalizationType: UITextAutocapitalizationType = .none
  var smartQuotesType: UITextSmartQuotesType = .no
  var smartDashesType: UITextSmartDashesType = .no
  var smartInsertDeleteType: UITextSmartInsertDeleteType = .no
  var inlinePredictionType: UITextInlinePredictionType = .no
  var keyboardType: UIKeyboardType = .default
  var returnKeyType: UIReturnKeyType = .default
  var keyboardAppearance: UIKeyboardAppearance = .default
  var enablesReturnKeyAutomatically = false

  init(core: EditorCore) {
    session = MarkedTextSession(core: core)
    super.init(frame: .zero)
    isOpaque = false
    for sublayer in decorations.layers { layer.addSublayer(sublayer) }
    selectionContainer.isUserInteractionEnabled = false
    addSubview(selectionContainer)
    layer.addSublayer(textHost)
    markedUnderline.isHidden = true
    layer.addSublayer(markedUnderline)
    selectionInteraction = UITextSelectionDisplayInteraction(textInput: self, delegate: self)
    selectionInteraction.cursorView = cursorView
    selectionInteraction.highlightView = highlightView
    selectionInteraction.handleViews = handleViews
    addInteraction(selectionInteraction)
    apply(theme: .default)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if selectionContainer.frame != bounds { selectionContainer.frame = bounds }
  }

  func apply(theme: ThemeColors) {
    highlightView.apply(theme: theme)
    cursorView.apply(theme: theme)
    for handle in handleViews { handle.apply(theme: theme) }
    markedUnderline.fillColor = theme.foreground
  }

  /// `on` turns autocorrection and inline predictions on; smart quotes and dashes stay off in every mode.
  func setSuggestions(_ mode: Suggestions) {
    let on = mode == .on
    autocorrectionType = on ? .yes : .no
    spellCheckingType = on ? .yes : .no
    inlinePredictionType = on ? .yes : .no
    smartQuotesType = .no
    smartDashesType = .no
    smartInsertDeleteType = .no
    if isFirstResponder { reloadInputViews() }
  }

  // Focus

  override var canBecomeFirstResponder: Bool { true }

  /// An empty input view under read only, so becoming first responder shows no keyboard.
  override var inputView: UIView? { isReadOnly ? emptyInputView : nil }

  override func becomeFirstResponder() -> Bool {
    let had = isFirstResponder
    let became = super.becomeFirstResponder()
    if became && !had {
      selectionInteraction.isActivated = true
      editor?.textInputFocusChanged(true)
    }
    return became
  }

  override func resignFirstResponder() -> Bool {
    let had = isFirstResponder
    let resigned = super.resignFirstResponder()
    if resigned && had {
      session.reset()
      selectionInteraction.isActivated = false
      editor?.textInputFocusChanged(false)
    }
    return resigned
  }

  func selectionContainerViewBelowText(for interaction: UITextSelectionDisplayInteraction) -> UIView? {
    selectionContainer
  }

  // UIKeyInput

  var hasText: Bool { (editor?.core.document.length ?? 0) > 0 }

  /// A tab outside a composition takes the tab command; everything else goes through the session, where a
  /// newline reaches the indenter and single scalars auto close.
  func insertText(_ text: String) {
    guard let editor, !editor.isReadOnly else { return }
    editor.markInputTime()
    editor.inputWork {
      if text == "\t" && session.marked == nil { editor.core.tab() } else { session.insertText(text) }
    }
    editor.revealAfterInput()
  }

  func deleteBackward() {
    guard let editor, !editor.isReadOnly else { return }
    editor.markInputTime()
    editor.inputWork { session.deleteBackward() }
    editor.revealAfterInput()
  }

  // UITextInput

  private var length: Int { editor?.core.document.length ?? 0 }

  private func offsets(_ range: UITextRange) -> (Int, Int)? {
    guard let r = range as? CPTextRange else { return nil }
    return (r.startOffset, r.endOffset)
  }

  func text(in range: UITextRange) -> String? {
    guard let editor, let (start, end) = offsets(range) else { return nil }
    return editor.core.document.text(start, end)
  }

  func replace(_ range: UITextRange, withText text: String) {
    guard let editor, !editor.isReadOnly, let (start, end) = offsets(range) else { return }
    editor.markInputTime()
    editor.inputWork { session.replace(TextRange(start: start, end: end), with: text) }
    editor.revealAfterInput()
  }

  var selectedTextRange: UITextRange? {
    get {
      guard let editor else { return nil }
      let sel = editor.core.selection
      return CPTextRange(start: sel.min, end: sel.max)
    }
    set {
      guard let (start, end) = newValue.flatMap({ offsets($0) }) else { return }
      session.setSelection(Selection(anchor: start, head: end))
    }
  }

  var markedTextRange: UITextRange? {
    session.marked.map { CPTextRange(start: $0.start, end: $0.end) }
  }

  func setMarkedText(_ markedText: String?, selectedRange: NSRange) {
    guard let editor, !editor.isReadOnly else { return }
    editor.markInputTime()
    editor.inputWork { session.setMarkedText(markedText ?? "", selectedRange: selectedRange) }
    editor.revealAfterInput()
  }

  func unmarkText() {
    guard let editor else { return }
    editor.inputWork { session.unmarkText() }
    editor.setNeedsLayout()
  }

  var beginningOfDocument: UITextPosition { CPTextPosition(offset: 0) }
  var endOfDocument: UITextPosition { CPTextPosition(offset: length) }

  func textRange(from fromPosition: UITextPosition, to toPosition: UITextPosition) -> UITextRange? {
    guard let a = fromPosition as? CPTextPosition, let b = toPosition as? CPTextPosition else { return nil }
    return CPTextRange(start: a.offset, end: b.offset)
  }

  func position(from position: UITextPosition, offset: Int) -> UITextPosition? {
    guard let p = position as? CPTextPosition else { return nil }
    let target = p.offset + offset
    return target >= 0 && target <= length ? CPTextPosition(offset: target) : nil
  }

  func position(from position: UITextPosition, in direction: UITextLayoutDirection, offset: Int) -> UITextPosition? {
    guard let p = position as? CPTextPosition, let editor else { return nil }
    switch direction {
    case .left: return self.position(from: p, offset: -offset)
    case .right: return self.position(from: p, offset: offset)
    case .up: return CPTextPosition(offset: editor.verticalMove(from: p.offset, rows: -offset))
    case .down: return CPTextPosition(offset: editor.verticalMove(from: p.offset, rows: offset))
    @unknown default: return nil
    }
  }

  func compare(_ position: UITextPosition, to other: UITextPosition) -> ComparisonResult {
    guard let a = position as? CPTextPosition, let b = other as? CPTextPosition else { return .orderedSame }
    if a.offset < b.offset { return .orderedAscending }
    return a.offset > b.offset ? .orderedDescending : .orderedSame
  }

  func offset(from: UITextPosition, to toPosition: UITextPosition) -> Int {
    guard let a = from as? CPTextPosition, let b = toPosition as? CPTextPosition else { return 0 }
    return b.offset - a.offset
  }

  func position(within range: UITextRange, farthestIn direction: UITextLayoutDirection) -> UITextPosition? {
    guard let (start, end) = offsets(range) else { return nil }
    switch direction {
    case .left, .up: return CPTextPosition(offset: start)
    default: return CPTextPosition(offset: end)
    }
  }

  func characterRange(byExtending position: UITextPosition, in direction: UITextLayoutDirection) -> UITextRange? {
    guard let p = position as? CPTextPosition else { return nil }
    switch direction {
    case .left, .up: return CPTextRange(start: max(0, p.offset - 1), end: p.offset)
    default: return CPTextRange(start: p.offset, end: min(length, p.offset + 1))
    }
  }

  func baseWritingDirection(for position: UITextPosition, in direction: UITextStorageDirection) -> NSWritingDirection {
    .leftToRight
  }

  func setBaseWritingDirection(_ writingDirection: NSWritingDirection, for range: UITextRange) {}

  func firstRect(for range: UITextRange) -> CGRect {
    guard let editor, let (start, end) = offsets(range) else { return .zero }
    return editor.selectionRects(start: start, end: end).first?.rect ?? editor.caretRect(offset: start)
  }

  func caretRect(for position: UITextPosition) -> CGRect {
    guard let editor, let p = position as? CPTextPosition else { return .zero }
    return editor.caretRect(offset: p.offset)
  }

  func selectionRects(for range: UITextRange) -> [UITextSelectionRect] {
    guard let editor, let (start, end) = offsets(range) else { return [] }
    return editor.selectionRects(start: start, end: end)
  }

  func closestPosition(to point: CGPoint) -> UITextPosition? {
    guard let editor else { return nil }
    return CPTextPosition(offset: editor.offsetAt(contentPoint: point))
  }

  func closestPosition(to point: CGPoint, within range: UITextRange) -> UITextPosition? {
    guard let editor, let (start, end) = offsets(range) else { return nil }
    return CPTextPosition(offset: max(start, min(editor.offsetAt(contentPoint: point), end)))
  }

  func characterRange(at point: CGPoint) -> UITextRange? {
    guard let editor else { return nil }
    let offset = editor.offsetAt(contentPoint: point)
    return offset < length ? CPTextRange(start: offset, end: offset + 1) : nil
  }
}
