import UIKit

enum Suggestions {
  case off
  case forceOff
  case on
}

/// The scroll view's content: the decoration layers, the selection container, the recycled line layers and the
/// marked text underline. UITextInput over the editor's UTF-16 offsets, the composition through the session,
/// the touches through the gesture machine and the edit menu over the selection.
final class TextInputView: UIView, UITextInput, UITextSelectionDisplayInteractionDelegate {
  static let gestureConfig = GestureMachine.Config(touchSlop: 10, doubleTapSlop: 40, doubleTapTimeout: 0.3, longPressTimeout: 0.5)

  let decorations = Decorations()
  let selectionContainer = UIView()
  let textHost = StillLayer()
  let markedUnderline = StillShapeLayer()
  let highlightView = HighlightView()
  let cursorView = CursorView()
  let handleViews = [HandleView(), HandleView()]
  private(set) var selectionInteraction: UITextSelectionDisplayInteraction!
  private(set) var gestures: EditorGestureRecognizer!
  private(set) var menu: EditMenu!
  /// The caret and handle pans; the scroll view's pan waits for them to fail.
  private(set) var dragRecognizers: [UIPanGestureRecognizer] = []
  weak var editor: CodeEditorView?
  var session: MarkedTextSession
  private let emptyInputView = UIView(frame: .zero)
  private var loupe: UITextLoupeSession?
  private var dragFixed = -1
  private var grab = CGPoint.zero
  /// Where the recorder's JSON lines go: os_log under the ime category, or a test's capture.
  var recorderLog: (String) -> Void = { RecordingTextInput.log.info("\($0, privacy: .public)") }
  private var recorder: RecordingTextInput?

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
    // The interaction installs handles only for its own text interaction, so the editor hosts and places ours.
    selectionInteraction.handleViews = [HiddenHandleView(), HiddenHandleView()]
    for (handle, direction) in zip(handleViews, [NSDirectionalRectEdge.leading, .trailing]) {
      handle.direction = direction
      handle.isHidden = true
      addSubview(handle)
    }
    addInteraction(selectionInteraction)
    gestures = EditorGestureRecognizer(host: self, config: TextInputView.gestureConfig)
    addGestureRecognizer(gestures)
    menu = EditMenu(view: self)
    for widget in [cursorView as UIView] + (handleViews as [UIView]) {
      let pan = UIPanGestureRecognizer(target: self, action: #selector(drag(_:)))
      widget.addGestureRecognizer(pan)
      dragRecognizers.append(pan)
    }
    apply(theme: .default)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if selectionContainer.frame != bounds { selectionContainer.frame = bounds }
  }

  /// The display interaction adds a container for its own range adjustment lollipops, shows it on every ranged
  /// selection and never positions them, so they would sit at the content origin. It resets hidden and alpha on
  /// each show, so an empty mask keeps it invisible.
  override func didAddSubview(_ subview: UIView) {
    super.didAddSubview(subview)
    if NSStringFromClass(type(of: subview)).contains("RangeAdjustment") { subview.layer.mask = CALayer() }
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

  // Recorder

  /// Android keeps the text out of the entries past this length, so do we.
  static let recordTextLimit = 1500

  /// The selection, the marked range and the text after a keyboard call, the Android imeState twin.
  func imeState() -> [String: Any] {
    guard let editor else { return [:] }
    let sel = editor.core.selection
    let doc = editor.core.document
    var state: [String: Any] = [
      "sel": [sel.anchor, sel.head], "marked": session.marked.map { [$0.start, $0.end] as Any } ?? NSNull(),
      "len": doc.length,
    ]
    if doc.length <= TextInputView.recordTextLimit { state["text"] = doc.text() }
    return state
  }

  /// Routes a keyboard call through the recorder while codepad_debug is on: it opens on the first call after
  /// focus and closes on blur, so each focus is one session.
  private func recording(_ call: String, _ args: [Any], _ block: () -> Void) {
    guard DebugSwitch.isOn else {
      recorder = nil
      block()
      return
    }
    if recorder == nil { recorder = RecordingTextInput(view: self, ime: textInputMode?.primaryLanguage) }
    recorder?.record(call, args, block)
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
      recorder = nil
      selectionInteraction.isActivated = false
      editor?.textInputFocusChanged(false)
    }
    return resigned
  }

  func selectionContainerViewBelowText(for interaction: UITextSelectionDisplayInteraction) -> UIView? {
    selectionContainer
  }

  // Edit menu

  override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
    guard let editor else { return false }
    let hasSelection = !editor.core.selection.isEmpty
    switch action {
    case #selector(cut(_:)): return !editor.isReadOnly && hasSelection
    case #selector(UIResponderStandardEditActions.copy(_:)): return hasSelection
    case #selector(paste(_:)): return !editor.isReadOnly && UIPasteboard.general.hasStrings
    case #selector(selectAll(_:)): return true
    default: return super.canPerformAction(action, withSender: sender)
    }
  }

  override func cut(_ sender: Any?) {
    editor?.cut()
  }

  override func copy(_ sender: Any?) {
    editor?.copySelection()
  }

  override func paste(_ sender: Any?) {
    editor?.paste()
  }

  override func selectAll(_ sender: Any?) {
    editor?.selectAll()
  }

  /// Presents the menu at the visible selection rows, or at the caret when the selection is collapsed.
  func showMenu() {
    guard let editor else { return }
    let sel = editor.core.selection
    var rect = editor.caretRect(offset: sel.head)
    if !sel.isEmpty {
      let rects = editor.selectionRects(start: sel.min, end: sel.max).map(\.rect)
      if let first = rects.first { rect = rects.dropFirst().reduce(first) { $0.union($1) } }
    }
    menu.show(at: rect)
  }

  // Hardware keys

  private static let keyInputs: [(Key, String)] = [
    (.left, UIKeyCommand.inputLeftArrow), (.right, UIKeyCommand.inputRightArrow), (.up, UIKeyCommand.inputUpArrow),
    (.down, UIKeyCommand.inputDownArrow), (.home, UIKeyCommand.inputHome), (.end, UIKeyCommand.inputEnd),
    (.pageUp, UIKeyCommand.inputPageUp), (.pageDown, UIKeyCommand.inputPageDown), (.escape, UIKeyCommand.inputEscape),
    (.tab, "\t"), (.letter("z"), "z"), (.letter("a"), "a"), (.letter("c"), "c"), (.letter("x"), "x"), (.letter("v"), "v"),
  ]
  private static let modifierFlags: [(Modifiers, UIKeyModifierFlags)] = [
    (.shift, .shift), (.option, .alternate), (.command, .command), (.control, .control),
  ]

  /// One command per combination the table maps, each ahead of the system's own text navigation.
  private static let commandTable: [UIKeyCommand] = {
    var commands: [UIKeyCommand] = []
    for (key, input) in keyInputs {
      for raw in 0..<8 {
        var mods: Modifiers = []
        var flags: UIKeyModifierFlags = []
        for (i, pair) in modifierFlags.prefix(3).enumerated() where raw & (1 << i) != 0 {
          mods.insert(pair.0)
          flags.insert(pair.1)
        }
        if KeyCommands.map(key, mods) == nil { continue }
        let command = UIKeyCommand(input: input, modifierFlags: flags, action: #selector(TextInputView.handleKeyCommand(_:)))
        command.wantsPriorityOverSystemBehavior = true
        commands.append(command)
      }
    }
    return commands
  }()

  override var keyCommands: [UIKeyCommand]? { TextInputView.commandTable }

  @objc private func handleKeyCommand(_ command: UIKeyCommand) {
    guard let input = command.input, let key = TextInputView.keyInputs.first(where: { $0.1 == input })?.0 else { return }
    var mods: Modifiers = []
    for (modifier, flag) in TextInputView.modifierFlags where command.modifierFlags.contains(flag) { mods.insert(modifier) }
    guard let editor, let mapped = KeyCommands.map(key, mods) else { return }
    editor.markInputTime()
    editor.inputWork { editor.perform(mapped) }
  }

  /// Forward delete has no key command input, so it arrives as a press.
  override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
    var handled = false
    for press in presses {
      if let key = press.key, handle(hidUsage: key.keyCode, modifiers: key.modifierFlags) { handled = true }
    }
    if !handled { super.pressesBegan(presses, with: event) }
  }

  /// True when the key is the editor's to consume; read only consumes forward delete without editing.
  func handle(hidUsage: UIKeyboardHIDUsage, modifiers: UIKeyModifierFlags) -> Bool {
    guard hidUsage == .keyboardDeleteForward, let editor else { return false }
    editor.markInputTime()
    editor.inputWork { editor.perform(.delete) }
    return true
  }

  override var undoManager: Foundation.UndoManager? { editor?.undoBridge }

  // Drags

  /// A caret or handle drag: the grabbed point keeps its offset from the finger and the loupe follows the finger.
  @objc private func drag(_ pan: UIPanGestureRecognizer) {
    guard let editor, let widget = pan.view else { return }
    let point = pan.location(in: self)
    let handle = widget as? HandleView
    switch pan.state {
    case .began:
      let sel = editor.core.selection
      dragFixed = handle.map { $0.direction == .leading ? sel.max : sel.min } ?? -1
      let center = widget.convert(handle?.rowCenter ?? CGPoint(x: widget.bounds.midX, y: widget.bounds.midY), to: self)
      grab = CGPoint(x: point.x - center.x, y: point.y - center.y)
      menu.hide()
      loupe?.invalidate()
      loupe = UITextLoupeSession.begin(at: point, fromSelectionWidgetView: widget, in: self)
      moveDrag(to: point)
    case .changed:
      moveDrag(to: point)
    case .ended:
      endLoupe()
      if handle != nil { showMenu() }
    case .cancelled, .failed:
      endLoupe()
    default:
      break
    }
  }

  private func moveDrag(to point: CGPoint) {
    guard let editor else { return }
    let offset = editor.offsetAt(contentPoint: CGPoint(x: point.x - grab.x, y: point.y - grab.y))
    editor.core.setSelection(anchor: dragFixed < 0 ? offset : dragFixed, head: offset)
    loupe?.move(to: point, withCaretRect: editor.caretRect(offset: offset), trackingCaret: true)
  }

  // UIKeyInput

  var hasText: Bool { (editor?.core.document.length ?? 0) > 0 }

  /// A tab outside a composition takes the tab command; everything else goes through the session, where a
  /// newline reaches the indenter and single scalars auto close.
  func insertText(_ text: String) {
    guard let editor, !editor.isReadOnly else { return }
    editor.markInputTime()
    editor.inputWork {
      recording("insertText", [text]) {
        if text == "\t" && session.marked == nil { editor.core.tab() } else { session.insertText(text) }
      }
    }
    editor.revealAfterInput()
  }

  func deleteBackward() {
    guard let editor, !editor.isReadOnly else { return }
    editor.markInputTime()
    editor.inputWork { recording("deleteBackward", []) { session.deleteBackward() } }
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
    editor.inputWork {
      recording("replace", [[start, end], text]) { session.replace(TextRange(start: start, end: end), with: text) }
    }
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
      recording("setSelection", [[start, end]]) { session.setSelection(Selection(anchor: start, head: end)) }
    }
  }

  var markedTextRange: UITextRange? {
    session.marked.map { CPTextRange(start: $0.start, end: $0.end) }
  }

  func setMarkedText(_ markedText: String?, selectedRange: NSRange) {
    guard let editor, !editor.isReadOnly else { return }
    editor.markInputTime()
    editor.inputWork {
      recording("setMarkedText", [markedText ?? "", [selectedRange.location, selectedRange.length]]) {
        session.setMarkedText(markedText ?? "", selectedRange: selectedRange)
      }
    }
    editor.revealAfterInput()
  }

  func unmarkText() {
    guard let editor else { return }
    editor.inputWork { recording("unmarkText", []) { session.unmarkText() } }
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

/// The machine's decisions, in content view coordinates.
extension TextInputView: @MainActor GestureHost {
  func offsetAt(x: CGFloat, y: CGFloat) -> Int {
    editor?.offsetAt(contentPoint: CGPoint(x: x, y: y)) ?? 0
  }

  func insideSelection(_ offset: Int) -> Bool {
    guard let sel = editor?.core.selection, !sel.isEmpty else { return false }
    return offset >= sel.min && offset <= sel.max
  }

  func caretHit(x: CGFloat, y: CGFloat) -> Bool {
    guard selectionInteraction.isActivated, cursorView.superview != nil, !cursorView.isHidden else { return false }
    return cursorView.frame.insetBy(dx: -CursorView.hitSlop, dy: 0).contains(CGPoint(x: x, y: y))
  }

  func placeCaret(_ offset: Int) {
    guard let editor else { return }
    menu.hide()
    editor.focus()
    editor.core.setSelection(anchor: offset, head: offset)
  }

  func selectWord(_ offset: Int) {
    guard let editor else { return }
    menu.hide()
    editor.focus()
    editor.core.selectWordAt(offset)
  }

  /// The line with its line break, so a cut removes the whole line.
  func selectLine(_ offset: Int) {
    guard let editor else { return }
    menu.hide()
    editor.focus()
    let doc = editor.core.document
    let line = doc.lineAt(offset)
    let end = line + 1 < doc.lineCount ? doc.lineStart(line + 1) : doc.lineEnd(line)
    editor.core.setSelection(anchor: doc.lineStart(line), head: end)
  }

  func beginLoupe(x: CGFloat, y: CGFloat) {
    loupe?.invalidate()
    loupe = UITextLoupeSession.begin(at: CGPoint(x: x, y: y), fromSelectionWidgetView: cursorView, in: self)
  }

  func moveLoupe(x: CGFloat, y: CGFloat) {
    guard let editor else { return }
    let caret = editor.caretRect(offset: editor.core.selection.head)
    loupe?.move(to: CGPoint(x: x, y: y), withCaretRect: caret, trackingCaret: true)
  }

  func endLoupe() {
    loupe?.invalidate()
    loupe = nil
  }

  func yieldToScroll() {
    gestures.yield()
  }

  func postLongPress(delay: TimeInterval) {
    gestures.postLongPress(delay: delay)
  }

  func cancelLongPress() {
    gestures.cancelLongPress()
  }
}
