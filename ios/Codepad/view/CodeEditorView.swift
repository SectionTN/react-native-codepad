import CoreText
import UIKit
import os

/// Draws the document through a viewport (height map, layout cache, gutter, active line) in a scroll view
/// whose content is TextInputView. layoutSubviews is the frame loop.
@MainActor
final class CodeEditorView: UIScrollView {
  /// revision is the snapshot the spans came from, -1 when the line was laid out plain.
  private final class Entry {
    let id: Int
    let layout: LineLayout
    let spans: [Int]?
    var revision: Int

    init(id: Int, layout: LineLayout, spans: [Int]?, revision: Int) {
      self.id = id
      self.layout = layout
      self.spans = spans
      self.revision = revision
    }
  }

  /// Row geometry in content view coordinates for the decoration paths; reads the cache only.
  @MainActor
  private final class ContentGeometry: @MainActor RowGeometry {
    unowned let view: CodeEditorView

    init(_ view: CodeEditorView) {
      self.view = view
    }

    var rowHeight: Int { view.rowMetrics().rowHeight }
    var spaceWidth: CGFloat { view.rowMetrics().spaceWidth }
    var viewHeight: Int { view.viewport.scrollY - view.viewport.insetTop + view.viewport.height }
    var originX: CGFloat { CodeEditorView.textPadding }
    func lineAt(_ offset: Int) -> Int { view.core.document.lineAt(offset) }
    func lineStart(_ line: Int) -> Int { view.core.document.lineStart(line) }
    func lineLength(_ line: Int) -> Int { view.core.document.lineLength(line) }
    func lineTop(_ line: Int) -> Int { view.heights.rowStart(line) * rowHeight }
    func rowCount(_ line: Int) -> Int { view.cache[line]?.layout.rowCount ?? 0 }
    func rowSpans(line: Int, from: Int, to: Int, _ out: (_ row: Int, _ left: CGFloat, _ right: CGFloat) -> Void) {
      view.cache[line]?.layout.selectionRows(from: from, to: to, out)
    }
  }

  /// Visual rows for the caret mover; lays out the lines it is asked about.
  @MainActor
  private final class ContentLineGeometry: @MainActor LineGeometry {
    unowned let view: CodeEditorView

    init(_ view: CodeEditorView) {
      self.view = view
    }

    private func layout(_ line: Int) -> LineLayout { (view.cache[line] ?? view.layoutLine(line)).layout }
    func rows(_ line: Int) -> Int { layout(line).rowCount }
    func rowOf(line: Int, column: Int) -> Int { layout(line).rowOf(column) }
    func caretX(line: Int, column: Int) -> CGFloat { layout(line).caretX(column) }
    func columnAt(line: Int, row: Int, x: CGFloat) -> Int { layout(line).columnAt(row: row, x: x) }
  }

  static let textPadding: CGFloat = 8
  static let gutterPadding: CGFloat = 8
  static let caretWidth: CGFloat = 2

  // The JS thread reads the core, the last frame and the focus through these locks.
  private let coreLock: OSAllocatedUnfairLock<EditorCore>
  private let frameLock = OSAllocatedUnfairLock(initialState: FrameInfo.empty)
  private let focusLock = OSAllocatedUnfairLock(initialState: false)
  nonisolated var core: EditorCore { coreLock.withLock { $0 } }
  nonisolated var latestFrame: FrameInfo { frameLock.withLock { $0 } }
  nonisolated var hasFocus: Bool { focusLock.withLock { $0 } }

  var onReady: (() -> Void)?
  var onScroll: ((FrameInfo) -> Void)?
  var onSelectionChange: ((Selection) -> Void)?
  var onChange: ((Change, ChangeOrigin) -> Void)?
  var onChangeText: ((String) -> Void)?
  var onContentSizeChange: ((CGSize) -> Void)?
  var onEditorFocus: (() -> Void)?
  var onEditorBlur: (() -> Void)?
  private(set) var isReadOnly = false

  let textInput: TextInputView
  private let clipboard = ClipboardActions()
  private let gutter = GutterView()
  private var theme = ThemeColors.default
  private var font: CTFont
  private var lineHeight: CGFloat = 1.4
  private var languageId: String?
  private var metrics: RowMetrics?
  private var snapshot: Snapshot?
  private var highlighter: Highlighter?
  private var engine: SyntaxEngine?
  private var heights: HeightMap
  private let viewport: Viewport
  private let cache = LayoutCache<Entry>(capacity: 64)
  private var nextEntryId = 0
  private var brackets: BracketHighlight
  private lazy var geometry = ContentGeometry(self)
  private lazy var lineGeometry = ContentLineGeometry(self)
  private var layers: [Int: LineLayer] = [:]
  private var pool: [LineLayer] = []
  private var placeholderLayer: LineLayer?
  private var placeholderLayout: LineLayout?
  private var lineNumbers = true
  private var highlightActiveLine = true
  private var placeholder: String?
  private var contentInsetTop: CGFloat = 0
  private var contentInsetBottom: CGFloat = 0
  private var contentInsetLeft: CGFloat = 0
  private var contentInsetRight: CGFloat = 0
  private var keyboardInset: CGFloat = 0
  private var ready = false
  private var scrollDirty = false
  private var selectionDirty = false
  private var selectionViewsDirty = false
  private var contentDirty = false
  private var revealPending = false
  private var autoFocusPending = false
  private var lastContentSize = CGSize(width: -1, height: -1)
  private var inputTime: TimeInterval = 0
  private var inputWork: TimeInterval = 0
  private var frameStart: TimeInterval = 0
  private var debugOn = false
  private var debugChecked: TimeInterval = 0

  override init(frame: CGRect) {
    let core = EditorCore()
    coreLock = OSAllocatedUnfairLock(initialState: core)
    font = CTFontCreateWithName("Menlo" as CFString, 14, nil)
    let heights = HeightMap(lineCount: 1)
    self.heights = heights
    viewport = Viewport(heights: heights)
    brackets = BracketHighlight(core: core)
    textInput = TextInputView(core: core)
    super.init(frame: frame)
    contentInsetAdjustmentBehavior = .never
    alwaysBounceVertical = true
    // The scroll edge effects would blur the first and last rows under the edges of the view.
    if #available(iOS 26.0, *) {
      for effect in [topEdgeEffect, bottomEdgeEffect, leftEdgeEffect, rightEdgeEffect] { effect.isHidden = true }
    }
    backgroundColor = UIColor(cgColor: theme.background)
    viewport.textPadding = Int(CodeEditorView.textPadding)
    gutter.padding = CodeEditorView.gutterPadding
    textInput.editor = self
    textInput.decorations.setTheme(theme)
    addSubview(textInput)
    addSubview(gutter)
    // Touches reach the content view at once, and a caret or handle drag beats the scroll, as in UITextView.
    delaysContentTouches = false
    for pan in textInput.dragRecognizers { panGestureRecognizer.require(toFail: pan) }
    wire(core)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  /// The revision of the snapshot the layers paint from, -1 without one.
  var snapshotRevision: Int { snapshot?.revision ?? -1 }

  func setInitialText(_ value: String) {
    let settings = core.settings
    let next = EditorCore(value)
    next.settings = settings
    coreLock.withLock { $0 = next }
    wire(next)
    ensureEngine().setText(value, revision: next.document.revision)
    resetDocument()
  }

  func setText(_ text: String, keepHistory: Bool) {
    textInput.session.reset()
    core.setText(text, keepHistory: keepHistory)
    viewport.scrollTo(0, 0)
    pushScroll()
    setNeedsLayout()
  }

  func setLanguage(_ id: String?) {
    if id == languageId { return }
    languageId = id
    highlighter = id.flatMap { LanguageRegistry.resolve($0) }.map { Highlighter(language: $0) }
    ensureEngine().setLanguage(id)
    // The old grammar's tree would paint garbage under the new query until the next snapshot lands.
    snapshot = nil
    cache.clear()
    setNeedsLayout()
  }

  func setTheme(_ colors: ThemeColors) {
    theme = colors
    backgroundColor = UIColor(cgColor: colors.background)
    gutter.theme = colors
    textInput.decorations.setTheme(colors)
    textInput.apply(theme: colors)
    placeholderLayout = nil
    cache.clear()
    selectionViewsDirty = true
    setNeedsLayout()
  }

  /// `family` resolves through UIFont, Menlo when nil or unknown; the size is in points.
  func setFont(family: String?, size: CGFloat, lineHeight: CGFloat) {
    self.lineHeight = lineHeight
    let name = family.flatMap { UIFont(name: $0, size: size)?.fontName } ?? "Menlo"
    font = CTFontCreateWithName(name as CFString, size, nil)
    metrics = nil
    placeholderLayout = nil
    relayout()
  }

  func setLineNumbers(_ enabled: Bool) {
    if lineNumbers == enabled { return }
    lineNumbers = enabled
    relayout()
  }

  func setSoftWrap(_ enabled: Bool) {
    if viewport.wrap == enabled { return }
    viewport.wrap = enabled
    relayout()
  }

  func setHighlightActiveLine(_ enabled: Bool) {
    highlightActiveLine = enabled
    setNeedsLayout()
  }

  func setMatchBrackets(_ enabled: Bool) {
    brackets.enabled = enabled
    setNeedsLayout()
  }

  func setReadOnly(_ enabled: Bool) {
    isReadOnly = enabled
    textInput.isReadOnly = enabled
  }

  func setSuggestions(_ mode: Suggestions) {
    textInput.setSuggestions(mode)
  }

  func setPlaceholder(_ text: String?) {
    placeholder = text
    placeholderLayout = nil
    setNeedsLayout()
  }

  /// Insets in points. The bottom inset is how consumers keep the caret above a toolbar.
  func setContentInsets(top: CGFloat, bottom: CGFloat, left: CGFloat, right: CGFloat) {
    contentInsetTop = top
    contentInsetBottom = bottom
    contentInsetLeft = left
    contentInsetRight = right
    applyInsets()
  }

  /// Points of the view under the keyboard, applied like a bottom inset.
  func applyKeyboardInset(_ points: CGFloat) {
    if points == keyboardInset { return }
    keyboardInset = points
    applyInsets()
  }

  func setScrollEnabled(_ enabled: Bool) {
    isScrollEnabled = enabled
  }

  func focus() {
    _ = textInput.becomeFirstResponder()
  }

  func blur() {
    _ = textInput.resignFirstResponder()
  }

  /// Focuses once, right away in a window or when the view joins one.
  func setAutoFocus(_ enabled: Bool) {
    autoFocusPending = enabled
    if enabled && window != nil { runAutoFocus() }
  }

  /// False when nothing is selected.
  @discardableResult
  func copySelection() -> Bool {
    clipboard.copy(core)
  }

  func cut(origin: ChangeOrigin = .input) {
    if !isReadOnly { clipboard.cut(core, origin: origin) }
  }

  func paste(origin: ChangeOrigin = .input) {
    if !isReadOnly && clipboard.paste(core, origin: origin) { revealAfterInput() }
  }

  func selectAll() {
    core.selectAll()
  }

  func scrollToLine(_ line: Int, animated: Bool) {
    let target = heights.rowStart(max(0, min(line, core.document.lineCount - 1))) * viewport.rowHeight
    if animated {
      setContentOffset(CGPoint(x: viewport.scrollX, y: min(target, viewport.maxScrollY)), animated: true)
    } else if viewport.scrollTo(viewport.scrollX, target) {
      pushScroll()
      onScrolled()
    }
  }

  /// Scrolls the least amount that shows the caret with the text padding around it.
  func revealSelection() {
    let m = rowMetrics()
    let doc = core.document
    let head = core.selection.head
    let line = doc.lineAt(head)
    let entry = cache[line] ?? layoutLine(line)
    let col = head - doc.lineStart(line)
    let row = entry.layout.rowOf(col)
    let x = Int(entry.layout.caretX(col).rounded())
    let top = (heights.rowStart(line) + row) * m.rowHeight
    if viewport.reveal(left: x, top: top, right: x + Int(CodeEditorView.caretWidth), bottom: top + m.rowHeight) {
      pushScroll()
      onScrolled()
    }
  }

  /// Document offset under a point of the visible area. Points left of the text snap to the row start, points below to the end.
  func offsetAt(x: CGFloat, y: CGFloat) -> Int {
    offsetAt(row: viewport.rowAt(Int(y.rounded(.down))), contentX: viewport.contentX(x))
  }

  /// The same for a point in the content view's coordinates, what UITextInput receives.
  func offsetAt(contentPoint point: CGPoint) -> Int {
    let row = Int((point.y / CGFloat(rowMetrics().rowHeight)).rounded(.down))
    return offsetAt(row: row, contentX: point.x - CodeEditorView.textPadding)
  }

  private func offsetAt(row: Int, contentX: CGFloat) -> Int {
    let doc = core.document
    if row < 0 { return 0 }
    if row >= heights.totalRows { return doc.length }
    let line = heights.lineAtRow(row)
    let entry = cache[line] ?? layoutLine(line)
    let rowInLine = max(0, min(row - heights.rowStart(line), entry.layout.rowCount - 1))
    return doc.lineStart(line) + entry.layout.columnAt(row: rowInLine, x: contentX)
  }

  /// The caret rect at an offset in content view coordinates.
  func caretRect(offset: Int) -> CGRect {
    let m = rowMetrics()
    let doc = core.document
    let line = doc.lineAt(offset)
    let entry = cache[line] ?? layoutLine(line)
    let col = offset - doc.lineStart(line)
    let top = CGFloat((heights.rowStart(line) + entry.layout.rowOf(col)) * m.rowHeight)
    return CGRect(
      x: CodeEditorView.textPadding + entry.layout.caretX(col), y: top, width: CodeEditorView.caretWidth,
      height: CGFloat(m.rowHeight))
  }

  /// One rect per visible row of [start, end) in content view coordinates, flagged at the selection ends.
  func selectionRects(start: Int, end: Int) -> [CPSelectionRect] {
    let doc = core.document
    let m = rowMetrics()
    var rects: [CGRect] = []
    Decorations.forEachRect(geometry, start: start, end: end, firstLine: viewport.firstVisibleLine()) { rects.append($0) }
    let startLine = doc.lineAt(start)
    let endLine = doc.lineAt(end)
    // The last rect carries the end only when the end's row was reached, not cut off by the view bottom.
    var endTop: CGFloat = -1
    if let entry = cache[endLine] {
      endTop = CGFloat((heights.rowStart(endLine) + entry.layout.rowOf(end - doc.lineStart(endLine))) * m.rowHeight)
    }
    return rects.enumerated().map { i, rect in
      CPSelectionRect(
        rect: rect, containsStart: i == 0 && startLine >= viewport.firstVisibleLine(),
        containsEnd: i == rects.count - 1 && rect.minY == endTop)
    }
  }

  /// Up or down by visual rows from an offset, for the keyboard's arrow handling.
  func verticalMove(from offset: Int, rows: Int) -> Int {
    CaretMover.move(doc: core.document, geometry: lineGeometry, offset: offset, rows: rows, goalX: nil).offset
  }

  /// Keyboard input moves the caret, so the next frame reveals it.
  func revealAfterInput() {
    revealPending = true
    setNeedsLayout()
  }

  /// Runs a block on the main thread from any thread, for the JS side.
  nonisolated func runOnMain(_ block: @escaping @Sendable @MainActor () -> Void) {
    Task { @MainActor in block() }
  }

  /// Remembers when input arrived so the next frame can log its latency, while the debug setting is on.
  func markInputTime(_ time: TimeInterval = CACurrentMediaTime()) {
    if inputTime == 0 && debugSwitch() { inputTime = time }
  }

  /// Adds the time a key handler or keyboard call spends on the main thread to the next paint line.
  func inputWork<T>(_ block: () throws -> T) rethrows -> T {
    let started = CACurrentMediaTime()
    defer { if inputTime != 0 { inputWork += CACurrentMediaTime() - started } }
    return try block()
  }

  /// The content view became or stopped being first responder.
  func textInputFocusChanged(_ focused: Bool) {
    focusLock.withLock { $0 = focused }
    selectionViewsDirty = true
    if focused { revealPending = true } else { textInput.menu.hide() }
    setNeedsLayout()
    if focused { onEditorFocus?() } else { onEditorBlur?() }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      textInput.menu.hide()
      textInput.endLoupe()
      engine?.close()
      engine = nil
      snapshot = nil
    } else {
      _ = ensureEngine()
      if autoFocusPending { runAutoFocus() }
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    frameStart = CACurrentMediaTime()
    let w = Int(bounds.width.rounded())
    let h = Int(bounds.height.rounded())
    if w != viewport.width || h != viewport.height { sizeChanged(w, h) }
    if viewport.scrollTo(Int(contentOffset.x.rounded()), Int(contentOffset.y.rounded())) { scrollDirty = true }
    if w == 0 || h == 0 { return }
    let doc = core.document
    let m = rowMetrics()
    if revealPending {
      revealPending = false
      revealSelection()
    }
    let first = viewport.firstVisibleLine()
    let lastBound = min(doc.lineCount - 1, first + h / m.rowHeight + 1)
    let scrollBefore = viewport.scrollY
    prepare(first, lastBound, m)
    if viewport.scrollY != scrollBefore { pushScroll() } else { updateContentSize() }
    let caretLine = doc.lineAt(core.selection.head)
    let lastLine = placeLayers(first, lastBound, m)
    placeGutter(first, lastLine, caretLine)
    placeDecorations(first, caretLine, m)
    placeMarkedUnderline(first)
    placeHandles()
    placePlaceholder(m)
    publish(first, lastLine, caretLine, m)
    if scrollDirty {
      scrollDirty = false
      textInput.menu.hide()
      onScroll?(latestFrame)
    }
    if contentDirty {
      contentDirty = false
      onContentSizeChange?(lastContentSize)
    }
    if selectionDirty {
      selectionDirty = false
      onSelectionChange?(core.selection)
    }
    if selectionViewsDirty {
      selectionViewsDirty = false
      textInput.selectionInteraction.setNeedsSelectionUpdate()
    }
    if !ready {
      ready = true
      onReady?()
    }
    logPaint()
  }

  private func wire(_ core: EditorCore) {
    core.onChange = { [weak self] change, origin in self?.onDocumentChange(change, origin) }
    core.onSelectionChange = { [weak self] _ in self?.onSelectionMoved() }
    let enabled = brackets.enabled
    brackets = BracketHighlight(core: core)
    brackets.enabled = enabled
    textInput.session = MarkedTextSession(core: core)
  }

  private func runAutoFocus() {
    autoFocusPending = false
    focus()
  }

  private func onSelectionMoved() {
    selectionDirty = true
    selectionViewsDirty = true
    if !textInput.session.applying {
      textInput.inputDelegate?.selectionWillChange(textInput)
      textInput.inputDelegate?.selectionDidChange(textInput)
    }
    setNeedsLayout()
  }

  private func onDocumentChange(_ change: Change, _ origin: ChangeOrigin) {
    let doc = core.document
    let first = doc.lineAt(change.start)
    let oldCount = lineSpan(change.removed)
    let newCount = lineSpan(change.inserted)
    heights.replaceLines(first: first, oldCount: oldCount, newCount: newCount)
    cache.shift(first: first, oldCount: oldCount, newCount: newCount)
    ensureEngine().edit(change, points: SyntaxEngine.pointsFor(doc: doc, change: change))
    if updateGutter() { relayout() } else { viewport.clamp() }
    if origin != .api { revealPending = true }
    // A change the keyboard did not make: it ends a composition it touched and the keyboard hears of it.
    let session = textInput.session
    if !session.applying {
      textInput.inputDelegate?.textWillChange(textInput)
      _ = session.onExternalChange(change)
      textInput.inputDelegate?.textDidChange(textInput)
    }
    textInput.cursorView.resetBlinkAnimation()
    textInput.menu.hide()
    selectionViewsDirty = true
    updateContentSize()
    setNeedsLayout()
    onChange?(change, origin)
    onChangeText?(doc.text())
  }

  private func lineSpan(_ text: String) -> Int {
    text.utf16.reduce(1) { $0 + ($1 == 10 ? 1 : 0) }
  }

  private func resetDocument() {
    heights = HeightMap(lineCount: core.document.lineCount)
    viewport.heights = heights
    cache.clear()
    viewport.widestLine = 0
    updateGutter()
    viewport.scrollTo(0, 0)
    pushScroll()
    selectionViewsDirty = true
    setNeedsLayout()
  }

  /// Width, wrap, font, gutter or inset changes drop every layout and keep the top visible line in place.
  private func relayout() {
    let anchor = viewport.anchor()
    let scrollX = viewport.scrollX
    viewport.rowHeight = rowMetrics().rowHeight
    cache.clear()
    heights.resetAll()
    viewport.widestLine = 0
    updateGutter()
    viewport.restore(anchor)
    // The visible lines are measured again right away so the horizontal position survives the widest line reset.
    layoutVisibleLines()
    viewport.scrollTo(scrollX, viewport.scrollY)
    pushScroll()
    selectionViewsDirty = true
    setNeedsLayout()
  }

  private func layoutVisibleLines() {
    var line = viewport.firstVisibleLine()
    while line < core.document.lineCount && line <= viewport.lastVisibleLine() {
      if cache[line] == nil { layoutLine(line) }
      line += 1
    }
  }

  @discardableResult
  private func updateGutter() -> Bool {
    let digit = RowMetrics.advance(of: "0", in: font)
    let w =
      lineNumbers
      ? GutterMetrics.width(lineCount: core.document.lineCount, digitAdvance: digit, padding: CodeEditorView.gutterPadding) : 0
    if w == viewport.gutterWidth { return false }
    viewport.gutterWidth = w
    return true
  }

  // Created on first use and after every re-attach, since detaching closes the parse queue.
  private func ensureEngine() -> SyntaxEngine {
    if let engine { return engine }
    let created = SyntaxEngine(
      postToMain: { block in DispatchQueue.main.async(execute: block) },
      onSnapshot: { [weak self] snapshot in MainActor.assumeIsolated { self?.onSnapshot(snapshot) } })
    engine = created
    created.setLanguage(languageId)
    created.setText(core.document.text(), revision: core.document.revision)
    return created
  }

  private func onSnapshot(_ next: Snapshot) {
    // A parse that started before a language switch still reports the old grammar; it must not paint.
    if next.languageId != languageId { return }
    snapshot = next
    if debugSwitch() {
      let s = next.stats
      DebugSwitch.log.info(
        "{\"call\":\"parse\",\"ms\":\(s.latencyMillis, privacy: .public),\"fresh\":\(s.freshInjections, privacy: .public),\"reused\":\(s.reusedInjections, privacy: .public)}"
      )
    }
    setNeedsLayout()
  }

  private func rowMetrics() -> RowMetrics {
    if let metrics { return metrics }
    let m = RowMetrics(font: font, lineHeight: lineHeight, tabSize: core.settings.tabSize)
    metrics = m
    viewport.rowHeight = m.rowHeight
    gutter.metrics = m
    return m
  }

  private func takeEntryId() -> Int {
    nextEntryId += 1
    return nextEntryId
  }

  private func makeLayout(_ line: Int, spans: [Int]?, _ m: RowMetrics) -> LineLayout {
    LineLayout(
      text: core.document.line(line), spans: spans ?? [], font: font, styles: theme, foreground: theme.foreground, metrics: m,
      wrapWidth: viewport.wrapWidth)
  }

  /// Lays out one line plain, for hit tests and reveals on lines outside the drawn range.
  @discardableResult
  private func layoutLine(_ line: Int) -> Entry {
    let entry = Entry(id: takeEntryId(), layout: makeLayout(line, spans: nil, rowMetrics()), spans: nil, revision: -1)
    cache.put(line, entry)
    let scrollBefore = viewport.scrollY
    measured(line, entry.layout)
    if viewport.scrollY != scrollBefore { pushScroll() } else { updateContentSize() }
    return entry
  }

  private func measured(_ line: Int, _ layout: LineLayout) {
    viewport.measured(line, layout.rowCount)
    if !viewport.wrap { viewport.widestLine = max(viewport.widestLine, Int(layout.width().rounded())) }
  }

  private func onScrolled() {
    scrollDirty = true
    setNeedsLayout()
  }

  /// Pushes the viewport's scroll into the scroll view after a programmatic change.
  private func pushScroll() {
    updateContentSize()
    let target = CGPoint(x: CGFloat(viewport.scrollX), y: CGFloat(viewport.scrollY))
    if contentOffset != target { contentOffset = target }
  }

  /// contentSize is the viewport's content plus its insets; the content view starts at the text area.
  private func updateContentSize() {
    let size = CGSize(
      width: CGFloat(viewport.textAreaLeft + viewport.contentWidth + viewport.insetRight),
      height: CGFloat(viewport.insetTop + viewport.contentHeight + viewport.insetBottom))
    if contentSize != size { contentSize = size }
    let frame = CGRect(
      x: CGFloat(viewport.textAreaLeft), y: CGFloat(viewport.insetTop), width: CGFloat(viewport.contentWidth),
      height: CGFloat(viewport.contentHeight))
    if textInput.frame != frame { textInput.frame = frame }
  }

  private func applyInsets() {
    let changed = viewport.setInsets(
      top: Int(contentInsetTop.rounded()), bottom: Int((contentInsetBottom + keyboardInset).rounded()),
      left: Int(contentInsetLeft.rounded()), right: Int(contentInsetRight.rounded()))
    if changed {
      relayout()
    } else if viewport.clamp() {
      pushScroll()
      onScrolled()
    } else {
      updateContentSize()
      setNeedsLayout()
    }
    if hasFocus { revealPending = true }
  }

  private func sizeChanged(_ w: Int, _ h: Int) {
    let widthChanged = viewport.resize(width: w, height: h)
    cache.capacity = max(64, 3 * (h / rowMetrics().rowHeight + 1))
    if widthChanged {
      relayout()
    } else if viewport.clamp() {
      pushScroll()
      onScrolled()
    }
  }

  /// Builds missing layouts for [first, last] with one highlight query over the lines that need it.
  private func prepare(_ first: Int, _ last: Int, _ m: RowMetrics) {
    let doc = core.document
    let consistent = snapshot.flatMap { $0.revision == doc.revision ? $0 : nil }
    let revision = consistent != nil && highlighter != nil ? doc.revision : -1
    var lo = -1
    var hi = -1
    if revision >= 0 {
      for line in first...last where cache[line]?.revision != revision {
        if lo < 0 { lo = line }
        hi = line
      }
    }
    var batch: [[Int]]? = nil
    if lo >= 0, let consistent, let highlighter {
      batch = highlighter.spans(snapshot: consistent, doc: doc, firstLine: lo, lastLine: hi)
    }
    for line in first...last {
      let entry = cache[line]
      let inBatch = batch != nil && line >= lo && line <= hi
      var fresh: [Int]? = nil
      if let batch, inBatch, !batch[line - lo].isEmpty { fresh = batch[line - lo] }
      if let entry {
        if !inBatch { continue }
        if entry.spans == fresh {
          entry.revision = revision
          continue
        }
      }
      let layout = makeLayout(line, spans: fresh, m)
      cache.put(line, Entry(id: takeEntryId(), layout: layout, spans: fresh, revision: inBatch ? revision : -1))
      measured(line, layout)
    }
  }

  /// The visible rect grown by half a screen each way, in content view coordinates: a line layer never
  /// gets a backing store beyond it, so a huge line costs a redraw on scroll instead of a giant bitmap.
  private func paintWindow() -> CGRect {
    let w = CGFloat(viewport.textAreaWidth)
    let h = CGFloat(viewport.height)
    let grown = CGRect(x: CGFloat(viewport.scrollX) - w / 2, y: CGFloat(viewport.scrollY - viewport.insetTop) - h / 2, width: 2 * w, height: 2 * h)
    return grown.intersection(CGRect(x: 0, y: 0, width: CGFloat(viewport.contentWidth), height: CGFloat(viewport.contentHeight)))
  }

  /// Gives every line from `first` a layer while it is on screen; returns the last line placed.
  private func placeLayers(_ first: Int, _ lastBound: Int, _ m: RowMetrics) -> Int {
    let scale = displayScale()
    let clip = paintWindow()
    var visible = Set<Int>()
    var lastLine = first
    var line = first
    while line <= lastBound {
      if viewport.lineTop(line) >= viewport.height { break }
      guard let entry = cache[line] else { break }
      let full = CGRect(
        x: 0, y: CGFloat(heights.rowStart(line) * m.rowHeight), width: CGFloat(viewport.contentWidth),
        height: CGFloat(entry.layout.rowCount * m.rowHeight))
      let clipped = full.intersection(clip)
      place(entry, clipped.isNull || clipped.isEmpty ? full : clipped, full, scale)
      visible.insert(entry.id)
      lastLine = line
      line += 1
    }
    for (id, layer) in layers where !visible.contains(id) {
      layers[id] = nil
      layer.removeFromSuperlayer()
      layer.layout = nil
      pool.append(layer)
    }
    return lastLine
  }

  private func place(_ entry: Entry, _ rect: CGRect, _ full: CGRect, _ scale: CGFloat) {
    let layer = layers[entry.id] ?? takeLayer(entry)
    let offset = CGPoint(x: rect.minX - full.minX, y: rect.minY - full.minY)
    let redraw =
      layer.layout !== entry.layout || layer.offset != offset || layer.bounds.size != rect.size || layer.contentsScale != scale
    if layer.frame != rect { layer.frame = rect }
    if redraw {
      layer.layout = entry.layout
      layer.offset = offset
      layer.contentsScale = scale
      layer.setNeedsDisplay()
    }
  }

  private func takeLayer(_ entry: Entry) -> LineLayer {
    let layer = pool.popLast() ?? LineLayer()
    layer.padding = CodeEditorView.textPadding
    textInput.textHost.addSublayer(layer)
    layers[entry.id] = layer
    return layer
  }

  private func displayScale() -> CGFloat {
    max(1, window?.screen.scale ?? traitCollection.displayScale)
  }

  private func placeGutter(_ first: Int, _ last: Int, _ caretLine: Int) {
    gutter.isHidden = !lineNumbers
    if !lineNumbers { return }
    let frame = CGRect(
      x: max(contentOffset.x, 0) + CGFloat(viewport.insetLeft), y: CGFloat(viewport.scrollY), width: CGFloat(viewport.gutterWidth),
      height: bounds.height)
    if gutter.frame != frame { gutter.frame = frame }
    var rows: [GutterView.Row] = []
    for line in first...last {
      rows.append(GutterView.Row(number: line + 1, top: CGFloat(viewport.lineTop(line)), active: line == caretLine))
    }
    gutter.update(rows)
  }

  /// Fills under the text: the bracket pair and the active line (search matches join them later).
  private func placeDecorations(_ first: Int, _ caretLine: Int, _ m: RowMetrics) {
    let d = textInput.decorations
    if highlightActiveLine && core.selection.isEmpty {
      d.setActiveLine(
        CGRect(
          x: 0, y: CGFloat(heights.rowStart(caretLine) * m.rowHeight), width: CGFloat(viewport.contentWidth),
          height: CGFloat(heights.rows(caretLine) * m.rowHeight)))
    } else {
      d.setActiveLine(nil)
    }
    let consistent = snapshot.flatMap { $0.revision == core.document.revision ? $0 : nil }
    if let pair = brackets.pair(snapshot: consistent, highlighter: highlighter) {
      let path = CGMutablePath()
      for offset in [pair.0, pair.1] {
        Decorations.addRects(path, geometry, start: offset, end: offset + 1, firstLine: first)
      }
      d.setBrackets(path.isEmpty ? nil : path)
    } else {
      d.setBrackets(nil)
    }
  }

  /// A one point line along the bottom of every row of the marked text, the composing cue.
  private func placeMarkedUnderline(_ first: Int) {
    let underline = textInput.markedUnderline
    guard let marked = textInput.session.marked else {
      underline.isHidden = true
      return
    }
    var strips: [CGRect] = []
    Decorations.forEachRect(geometry, start: marked.start, end: marked.end, firstLine: first) { rect in
      strips.append(CGRect(x: rect.minX, y: rect.maxY - 1, width: rect.width, height: 1))
    }
    guard let bounds = strips.dropFirst().reduce(strips.first, { $0?.union($1) }) else {
      underline.isHidden = true
      return
    }
    let path = CGMutablePath()
    for strip in strips { path.addRect(strip.offsetBy(dx: -bounds.minX, dy: -bounds.minY)) }
    underline.frame = bounds
    underline.path = path
    underline.isHidden = false
  }

  /// The handles wrap the caret rects of a ranged selection while the editor has focus.
  private func placeHandles() {
    let sel = core.selection
    let shown = hasFocus && !sel.isEmpty
    for (handle, offset) in zip(textInput.handleViews, [sel.min, sel.max]) {
      handle.isHidden = !shown
      if !shown { continue }
      let frame = handle.preferredFrame(for: caretRect(offset: offset))
      if handle.frame != frame { handle.frame = frame }
    }
  }

  /// One layer in gutterForeground on the first row while the document is empty.
  private func placePlaceholder(_ m: RowMetrics) {
    guard let placeholder, core.document.length == 0 else {
      placeholderLayer?.isHidden = true
      return
    }
    let layer: LineLayer
    if let existing = placeholderLayer {
      layer = existing
    } else {
      layer = LineLayer()
      layer.padding = CodeEditorView.textPadding
      textInput.textHost.addSublayer(layer)
      placeholderLayer = layer
    }
    if placeholderLayout == nil {
      placeholderLayout = LineLayout(
        text: Array(placeholder.utf16), spans: [], font: font, styles: theme, foreground: theme.gutterForeground, metrics: m,
        wrapWidth: 0)
    }
    let frame = CGRect(x: 0, y: 0, width: CGFloat(viewport.contentWidth), height: CGFloat(m.rowHeight))
    let scale = displayScale()
    if layer.layout !== placeholderLayout || layer.frame != frame || layer.contentsScale != scale {
      layer.layout = placeholderLayout
      layer.frame = frame
      layer.contentsScale = scale
      layer.setNeedsDisplay()
    }
    layer.isHidden = false
  }

  /// The caret rect in visible area points, nil while the line has no layout.
  private func caretRect(_ m: RowMetrics, line: Int) -> CGRect? {
    guard let entry = cache[line] else { return nil }
    let col = core.selection.head - core.document.lineStart(line)
    let x = viewport.viewX(entry.layout.caretX(col))
    let top = CGFloat(viewport.lineTop(line) + entry.layout.rowOf(col) * m.rowHeight)
    return CGRect(x: x, y: top, width: CodeEditorView.caretWidth, height: CGFloat(m.rowHeight))
  }

  private func publish(_ first: Int, _ last: Int, _ caretLine: Int, _ m: RowMetrics) {
    let frame = FrameInfo(
      firstLine: first, lastLine: last, caret: caretRect(m, line: caretLine), scrollX: CGFloat(viewport.scrollX),
      scrollY: CGFloat(viewport.scrollY), contentWidth: CGFloat(viewport.contentWidth),
      contentHeight: CGFloat(viewport.contentHeight))
    frameLock.withLock { $0 = frame }
    let size = CGSize(
      width: CGFloat(viewport.textAreaLeft + viewport.contentWidth + viewport.insetRight),
      height: CGFloat(viewport.insetTop + viewport.contentHeight + viewport.insetBottom) - keyboardInset)
    if size != lastContentSize {
      lastContentSize = size
      contentDirty = true
    }
  }

  // Re-read at most once a second, so the setting can be flipped while the editor stays up.
  private func debugSwitch() -> Bool {
    let now = CACurrentMediaTime()
    if now - debugChecked > 1 {
      debugChecked = now
      debugOn = DebugSwitch.isOn
    }
    return debugOn
  }

  private func logPaint() {
    if inputTime == 0 { return }
    let now = CACurrentMediaTime()
    let latency = Int(((now - inputTime) * 1000).rounded())
    let work = Int(((inputWork + now - frameStart) * 1000).rounded())
    DebugSwitch.log.info("{\"call\":\"paint\",\"latency\":\(latency, privacy: .public),\"work\":\(work, privacy: .public)}")
    inputWork = 0
    inputTime = 0
  }
}
