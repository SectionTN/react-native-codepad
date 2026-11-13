package me.sectiontn.codepad.view

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.TextPaint
import android.util.Log
import android.util.TypedValue
import android.view.KeyCharacterMap
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.View
import android.view.ViewConfiguration
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.widget.Magnifier
import me.sectiontn.codepad.core.Change
import me.sectiontn.codepad.core.ChangeOrigin
import me.sectiontn.codepad.core.Decoration
import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.core.EditorFrame
import me.sectiontn.codepad.core.EditorSettings
import me.sectiontn.codepad.core.FrameReader
import me.sectiontn.codepad.core.Range
import me.sectiontn.codepad.core.SearchQuery
import me.sectiontn.codepad.core.Selection
import me.sectiontn.codepad.core.TextMovement
import me.sectiontn.codepad.input.CoreCommands
import me.sectiontn.codepad.input.ImeSession
import me.sectiontn.codepad.input.KeyCommand
import me.sectiontn.codepad.input.KeyCommands
import me.sectiontn.codepad.layout.CaretMover
import me.sectiontn.codepad.layout.GutterMetrics
import me.sectiontn.codepad.layout.LayoutCache
import me.sectiontn.codepad.layout.LineGeometry
import me.sectiontn.codepad.layout.LineLayout
import me.sectiontn.codepad.layout.RowGeometry
import me.sectiontn.codepad.layout.RowMetrics
import me.sectiontn.codepad.layout.Viewport
import me.sectiontn.codepad.syntax.CoreNative
import me.sectiontn.codepad.syntax.Highlighter
import me.sectiontn.codepad.syntax.LanguageRegistry
import me.sectiontn.codepad.syntax.Snapshot
import me.sectiontn.codepad.syntax.SyntaxEngine
import me.sectiontn.codepad.syntax.shiftSpans
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

/**
 * Draws the document through a viewport (height map, layout cache, gutter, active line, selection, caret,
 * handles) and handles touch: scrolling with flings, taps, double taps, long press word selection and
 * handle drags.
 */
class CodeEditorView(context: Context) : View(context) {
  // Replaced once when initialValue loads. The JS thread reads it, so the reference must be volatile.
  @Volatile
  var core: EditorCore = EditorCore()
    private set

  @Volatile
  var frame: FrameInfo = FrameInfo.EMPTY
    private set

  var typefaceResolver: ((String) -> Typeface?)? = null
  var onFirstDraw: (() -> Unit)? = null
  var onScrollListener: ((FrameInfo) -> Unit)? = null
  var onSelectionListener: ((Selection) -> Unit)? = null
  var onContentSizeListener: ((Float, Float) -> Unit)? = null
  var onGapLayoutListener: ((List<GapRect>) -> Unit)? = null

  var isScrollEnabled = true
    private set

  var isReadOnly = false
    private set

  // revision is the snapshot the spans came from, -1 when the line was laid out plain.
  private class Entry(val layout: LineLayout, val spans: IntArray?, var revision: Int)

  private val density = resources.displayMetrics.density
  private val mainHandler = Handler(Looper.getMainLooper())
  private val paint = TextPaint(TEXT_FLAGS)
  private val gutterPaint = TextPaint(TEXT_FLAGS)
  private var theme: ThemeColors = ThemeColors.default
  private var lineHeight = 1.4f
  private var languageId: String? = null
  private var metrics: RowMetrics? = null
  private var snapshot: Snapshot? = null
  // The revision of the last snapshot prepare consumed; a snapshot based on it re-queries only the lines it changed.
  private var appliedRevision = -1
  // The dropped entry's spans moved along a one line change, painted until the snapshot lands.
  private var pendingSpans: IntArray? = null
  private var pendingTail: IntArray? = null
  private var pendingLine = -1
  private var pendingRevision = -1
  private var highlighter: Highlighter? = null
  // Read by the instrumented tests, which hold its worker.
  var engine: SyntaxEngine? = null
    private set

  private val viewport = Viewport()
  private val cache = LayoutCache<Entry>(64)
  // The draw's (line, revision) pairs for the frame call and (line, rows) pairs for the measure call, kept across draws.
  private var framePairs = IntArray(256)
  private var measurePairs = IntArray(64)
  private val frameReader = FrameReader()
  // The frame of the draw in progress: from the frame call to the end of publish, every read comes from it.
  private var drawFrame: EditorFrame? = null
  private val painter = EditorPainter(viewport, { cache[it]?.layout }, paint, gutterPaint, density)
  private val decorationPainter = DecorationPainter(density)
  private var goalX: Float? = null
  private var movingVertically = false
  private val geometry = object : LineGeometry {
    private fun entry(line: Int) = cache[line] ?: layoutLine(line)
    override fun rows(line: Int): Int = entry(line).layout.rowCount
    override fun rowOf(line: Int, column: Int): Int = entry(line).layout.rowOf(column)
    override fun caretX(line: Int, column: Int): Float = entry(line).layout.caretX(column)
    override fun columnAt(line: Int, row: Int, x: Float): Int = entry(line).layout.columnAt(row, x)
  }

  private val decorations = Decorations()

  // Fills read the cache only, so a line without a layout ends the walk instead of building one.
  private val rowGeometry = object : RowGeometry {
    override val rowHeight: Int get() = rowMetrics().rowHeight
    override val spaceWidth: Float get() = rowMetrics().spaceWidth
    override val viewHeight: Int get() = height
    override val originX: Float get() = viewport.viewX(0f)
    override fun lineAt(offset: Int): Int = docLineAt(offset)
    override fun lineStart(line: Int): Int = docLineStart(line)
    override fun lineLength(line: Int): Int = docLineLength(line)
    override fun lineTop(line: Int): Int = viewport.lineTop(line)
    override fun rowCount(line: Int): Int = cache[line]?.layout?.rowCount ?: 0
    override fun rowSpans(line: Int, from: Int, to: Int, out: (row: Int, left: Float, right: Float) -> Unit) {
      cache[line]?.layout?.selectionRows(from, to, out)
    }
  }

  private var lineNumbers = true
  private var highlightActiveLine = true
  private var brackets = BracketHighlight(core)
  private var search: SearchController? = null
  private var placeholder: String? = null
  private var drawn = false

  private val viewConfig = ViewConfiguration.get(context)
  private val scroller = ScrollController(context, this)
  private val gestures = GestureMachine(
    GestureHost(),
    GestureMachine.Config(
      touchSlop = viewConfig.scaledTouchSlop.toFloat(),
      doubleTapSlop = viewConfig.scaledDoubleTapSlop.toFloat(),
      doubleTapTimeout = ViewConfiguration.getDoubleTapTimeout().toLong(),
      longPressTimeout = ViewConfiguration.getLongPressTimeout().toLong(),
    ),
  )
  private val longPressRunnable = Runnable { gestures.longPress() }
  private var velocity: VelocityTracker? = null
  private var touchX = 0f
  private var touchY = 0f
  private var scrollDirty = false
  private var wordAnchor = Range(0, 0)

  private val handles = SelectionHandles(context)
  private var magnifier: Magnifier? = null
  private var caretVisible = true
  private var selectionDirty = false
  private var dropped = false

  // True once release() freed the core of a dropped view, so its input connection stops calling it.
  internal var coreReleased = false
    private set
  private var contentDirty = false
  private var lastContentWidth = -1f
  private var lastContentHeight = -1f
  private var gapsDirty = false
  private var grabDy = 0f
  private var dragFixed = 0
  private var anchorX = 0f
  private var anchorY = 0f
  private val blink = object : Runnable {
    override fun run() {
      caretVisible = !caretVisible
      invalidate()
      // A flipped debug setting swaps the recording connection in or out without a tap.
      if (debugSwitch() != recording) restartInput()
      postDelayed(this, CARET_BLINK_MS)
    }
  }
  private val hideInsertion = Runnable {
    handles.insertionVisible = false
    invalidate()
  }
  private val clipboard = ClipboardActions(context)
  private val menu = EditMenu(this, MenuHost())

  var onFocusListener: ((Boolean) -> Unit)? = null
  var onChangeListener: ((Change, ChangeOrigin) -> Unit)? = null

  // Read on the JS thread by isFocused().
  @Volatile
  var focused = false
    private set

  var ime = ImeSession(core)
    private set

  var lastInputType = 0
    private set

  private val bridge = InputMethodBridge(this)
  private var suggestions = InputMethodBridge.Suggestions.Off
  private var autoFocusPending = false
  private var imeDirty = false
  private var anchorDirty = false
  private var cursorUpdateOnce = false
  private var revealPending = false
  // Keyboard avoidance: the tracker turns the window's IME overlap into a second bottom inset in px.
  private var avoidsKeyboard = false
  private var keyboardInset = 0
  private var keyboardTracker: KeyboardInsetTracker? = null
  private var contentInsetTop = 0f
  private var contentInsetBottom = 0f
  private var contentInsetLeft = 0f
  private var contentInsetRight = 0f
  private var inputTime = 0L
  private var inputWork = 0L
  private var drawStart = 0L
  private var debugOn = false
  private var debugChecked = 0L
  private var recording = false
  private var recorder: RecordingInputConnection? = null
  private var externalSelection = false

  init {
    isFocusable = true
    isFocusableInTouchMode = true
    gutterPaint.textAlign = Paint.Align.RIGHT
    applyFont(Typeface.MONOSPACE, 14f)
    paint.color = theme.foreground
    scroller.setColor(theme.foreground)
    handles.setColor(theme.cursor)
    viewport.textPadding = dp(TEXT_PADDING_DP)
    wire(core)
  }

  fun setInitialText(value: String) {
    val settings = core.settings
    val old = core
    core = EditorCore(value).also { it.settings = settings }
    wire(core)
    val existing = engine
    if (existing != null) existing.attach(core) else engine()
    old.close()
    // The new document starts at revision 0 like the old one, so a kept snapshot would pass the revision check.
    snapshot?.let { engine?.release(it) ?: it.close() }
    snapshot = null
    resetDocument()
    if (isFocused) restartInput()
  }

  fun setText(text: String, keepHistory: Boolean) {
    ime.reset()
    core.setText(text, keepHistory)
    viewport.scrollTo(0, 0)
    restartInput()
    invalidate()
  }

  fun setLanguage(id: String?) {
    if (id == languageId) return
    languageId = id
    highlighter = id?.let { LanguageRegistry.resolve(it) }?.let { Highlighter(it) }
    engine().setLanguage(id)
    // The old grammar's tree would paint garbage under the new query until the next snapshot lands.
    snapshot?.close()
    snapshot = null
    cache.clear()
    invalidate()
  }

  fun setTheme(colors: ThemeColors) {
    theme = colors
    painter.theme = colors
    paint.color = colors.foreground
    scroller.setColor(colors.foreground)
    handles.setColor(colors.cursor)
    cache.clear()
    invalidate()
  }

  fun setFont(family: String?, sizeDp: Float, lineHeightMultiplier: Float) {
    lineHeight = lineHeightMultiplier
    // React Native's font manager answers a name it does not know with the system default.
    val typeface = family?.let { typefaceResolver?.invoke(it) }?.takeUnless { it === Typeface.DEFAULT }
    applyFont(typeface ?: Typeface.MONOSPACE, sizeDp)
    relayout()
  }

  fun setLineNumbers(enabled: Boolean) {
    if (lineNumbers == enabled) return
    lineNumbers = enabled
    relayout()
  }

  fun setSoftWrap(enabled: Boolean) {
    if (viewport.wrap == enabled) return
    viewport.wrap = enabled
    relayout()
  }

  fun setHighlightActiveLine(enabled: Boolean) {
    highlightActiveLine = enabled
    invalidate()
  }

  fun setMatchBrackets(enabled: Boolean) {
    brackets.enabled = enabled
    invalidate()
  }

  fun setReadOnly(enabled: Boolean) {
    if (isReadOnly == enabled) return
    isReadOnly = enabled
    if (!isFocused) return
    if (enabled) bridge.hideKeyboard()
    restartInput()
  }

  fun setSuggestions(mode: InputMethodBridge.Suggestions) {
    if (suggestions == mode) return
    suggestions = mode
    if (isFocused) restartInput()
  }

  fun setAutoFocus(enabled: Boolean) {
    autoFocusPending = enabled
    if (enabled && isAttachedToWindow) runAutoFocus()
  }

  fun setEditorSettings(settings: EditorSettings) {
    if (core.settings == settings) return
    val tabChanged = core.settings.tabSize != settings.tabSize
    core.settings = settings
    if (tabChanged) {
      metrics = null
      relayout()
    }
  }

  fun focus() {
    requestFocus()
    showKeyboard()
  }

  fun blur() {
    bridge.hideKeyboard()
    clearFocus()
  }

  fun undo() {
    ime.reset()
    if (!core.undo()) return
    restartInput()
    revealPending = true
    invalidate()
  }

  fun redo() {
    ime.reset()
    if (!core.redo()) return
    restartInput()
    revealPending = true
    invalidate()
  }

  fun setPlaceholder(text: String?) {
    placeholder = text
    invalidate()
  }

  /** Insets in dp. The bottom inset is how consumers keep the caret above a toolbar. */
  fun setContentInsets(top: Float, bottom: Float, left: Float, right: Float) {
    contentInsetTop = top
    contentInsetBottom = bottom
    contentInsetLeft = left
    contentInsetRight = right
    applyInsets()
  }

  /** Space in dp between the text and the left and right edges of the text area. */
  fun setTextPadding(value: Float) {
    val px = dp(value.coerceAtLeast(0f))
    if (px == viewport.textPadding) return
    viewport.textPadding = px
    relayout()
    if (isFocused) revealPending = true
  }

  /** Pixels of the view under the keyboard, from KeyboardInsetTracker; applied like a bottom inset. */
  fun applyKeyboardInset(px: Int) {
    if (px == keyboardInset) return
    keyboardInset = px
    applyInsets()
  }

  /** Follows the window's IME insets while attached; off by default. */
  fun setAvoidKeyboard(on: Boolean) {
    avoidsKeyboard = on
    if (on && isAttachedToWindow) startKeyboardTracker() else stopKeyboardTracker()
  }

  val isAvoidingKeyboard: Boolean get() = keyboardTracker != null

  private fun applyInsets() {
    when {
      viewport.setInsets(dp(contentInsetTop), dp(contentInsetBottom) + keyboardInset, dp(contentInsetLeft), dp(contentInsetRight)) -> relayout()
      viewport.clamp() -> onScrolled()
      else -> invalidate()
    }
    if (isFocused) revealPending = true
  }

  private fun startKeyboardTracker() {
    if (keyboardTracker != null) return
    keyboardTracker = KeyboardInsetTracker(this, ::applyKeyboardInset).also { it.start() }
  }

  private fun stopKeyboardTracker() {
    keyboardTracker?.stop()
    keyboardTracker = null
  }

  fun setScrollEnabled(enabled: Boolean) {
    if (enabled == isScrollEnabled) return
    isScrollEnabled = enabled
    scroller.abort()
  }

  fun scrollToLine(line: Int, animated: Boolean) {
    val target = viewport.rowStart(line.coerceIn(0, core.document.lineCount - 1)) * viewport.rowHeight
    scroller.abort()
    val s = viewport.scroll()
    if (animated) {
      scroller.animateTo(s.x, s.y, s.x, target.coerceIn(0, s.maxY))
    } else if (viewport.scrollTo(s.x, target)) {
      onScrolled()
    }
  }

  /** Scrolls the least amount that shows the caret with the text padding around it. */
  fun revealSelection() {
    val m = rowMetrics()
    val head = core.selection.head
    val line = core.document.lineAt(head)
    val entry = cache[line] ?: layoutLine(line)
    val col = head - core.document.lineStart(line)
    val row = entry.layout.rowOf(col)
    val x = Math.round(entry.layout.caretX(col))
    val top = (viewport.rowStart(line) + row) * m.rowHeight
    scroller.abort()
    if (viewport.reveal(x, top, x + dp(EditorPainter.CARET_WIDTH_DP), top + m.rowHeight)) onScrolled()
  }

  /** Document offset under a view point. Points left of the text snap to the row start, points below to the end. */
  fun offsetAt(x: Float, y: Float): Int {
    val doc = core.document
    val row = viewport.rowAt(y.toInt())
    if (row < 0) return 0
    if (row >= viewport.totalRows) return doc.length
    val line = viewport.lineAtRow(row)
    val entry = cache[line] ?: layoutLine(line)
    val rowInLine = (row - viewport.rowStart(line)).coerceIn(0, entry.layout.rowCount - 1)
    return doc.lineStart(line) + entry.layout.columnAt(rowInLine, viewport.contentX(x))
  }

  fun copy(): Boolean = clipboard.copy(core)

  fun cut(origin: ChangeOrigin = ChangeOrigin.Input) {
    if (!isReadOnly) clipboard.cut(core, origin)
  }

  fun paste(origin: ChangeOrigin = ChangeOrigin.Input) {
    if (!isReadOnly && clipboard.paste(core, origin)) revealSelection()
  }

  fun selectAll() {
    core.selectAll()
    menu.invalidateContentRect()
  }

  /** Throws IllegalArgumentException for an invalid regex. The matches arrive through whenSearchFresh. */
  fun setSearch(query: SearchQuery) = search().setQuery(query)

  fun clearSearch(): Unit = search?.setQuery(null) ?: Unit

  fun whenSearchFresh(block: () -> Unit) = search?.whenFresh(block) ?: block()

  val matchCount: Int get() = core.matchCount

  fun findNext(): EditorCore.SearchHit? = core.findNext().also { afterSearchMove() }

  fun findPrevious(): EditorCore.SearchHit? = core.findPrevious().also { afterSearchMove() }

  fun replaceCurrent(text: String): Boolean = core.replaceCurrent(text).also { afterSearchMove() }

  fun replaceAll(text: String): Int = core.replaceAll(text).also { afterSearchMove() }

  private fun afterSearchMove() {
    revealSelection()
    invalidate()
  }

  private fun applyFont(typeface: Typeface, sizeDp: Float) {
    val size = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, sizeDp, resources.displayMetrics)
    paint.typeface = typeface
    paint.textSize = size
    gutterPaint.typeface = typeface
    gutterPaint.textSize = size
    metrics = null
  }

  private fun wire(core: EditorCore) {
    core.onChange = { change, origin -> onDocumentChange(change, origin) }
    core.onSelectionChange = { onSelectionMoved() }
    viewport.attach(core)
    ime = ImeSession(core)
    brackets = BracketHighlight(core).also { it.enabled = brackets.enabled }
    search?.close()
    search = null
  }

  private fun search(): SearchController = search ?: SearchController(core, { post(it) }).also { controller ->
    controller.onResult = { count, ms ->
      if (debugSwitch()) Log.i(DebugSwitch.TAG, "{\"call\":\"search\",\"count\":$count,\"ms\":$ms}")
      invalidate()
    }
    search = controller
  }

  private fun onSelectionMoved() {
    if (!movingVertically) goalX = null
    selectionDirty = true
    if (!ime.applying) externalSelection = true
    imeDirty = true
    anchorDirty = true
    restartBlink()
  }

  private fun onDocumentChange(change: Change, origin: ChangeOrigin) {
    val doc = core.document
    val first = doc.lineAt(change.start)
    val oldCount = lineSpan(change.removed)
    val newCount = lineSpan(change.inserted)
    // The core already moved the rows and gaps and clamped the scroll.
    keepSpans(first, oldCount, newCount, change)
    cache.shift(first, oldCount, newCount)
    search?.onChange(change)
    if (updateGutter()) relayout()
    hideInsertionHandle()
    menu.hide()
    restartBlink()
    imeDirty = true
    anchorDirty = true
    if (origin != ChangeOrigin.Api) revealPending = true
    if (!ime.applying && ime.onExternalChange(change)) restartInput()
    invalidate()
    onChangeListener?.invoke(change, origin)
  }

  private fun lineSpan(text: String): Int {
    var n = 1
    for (c in text) if (c == '\n') n++
    return n
  }

  /** Replaces the decorations. [revision] is the one they were computed for, below zero for the current text. */
  fun setDecorations(items: List<Decoration>, revision: Int) {
    // The core moves the gaps and keeps the top visible line in place.
    if (!core.setDecorations(items, revision)) return
    invalidate()
  }

  private fun resetDocument() {
    cache.clear()
    viewport.widestLine = 0
    updateGutter()
    viewport.scrollTo(0, 0)
    invalidate()
  }

  /** Width, wrap, font, gutter or inset changes drop every layout and keep the top visible line in place. */
  private fun relayout() {
    anchorDirty = true
    val anchor = viewport.anchor()
    val scrollX = viewport.scrollX
    viewport.rowHeight = rowMetrics().rowHeight
    cache.clear()
    viewport.resetRows()
    viewport.widestLine = 0
    updateGutter()
    viewport.restore(anchor)
    // The visible lines are measured again right away so the horizontal position survives the widest line reset.
    layoutVisibleLines()
    viewport.scrollTo(scrollX, viewport.scrollY)
    invalidate()
  }

  private fun layoutVisibleLines() {
    var line = viewport.firstVisibleLine()
    while (line < core.document.lineCount && line <= viewport.lastVisibleLine()) {
      if (cache[line] == null) layoutLine(line)
      line++
    }
  }

  private fun updateGutter(): Boolean {
    val w = if (lineNumbers) {
      GutterMetrics.width(core.document.lineCount, paint.measureText("0"), dp(EditorPainter.GUTTER_PADDING_DP).toFloat())
    } else {
      0
    }
    if (w == viewport.gutterWidth) return false
    viewport.gutterWidth = w
    return true
  }

  // Created on first use and after every re-attach, since detaching closes the parse thread.
  private fun engine(): SyntaxEngine = engine ?: SyntaxEngine(
    postToMain = { mainHandler.post(it) },
    onSnapshot = { onSnapshot(it) },
  ).also {
    engine = it
    it.setLanguage(languageId)
    it.attach(core)
  }

  private fun onSnapshot(next: Snapshot) {
    // A parse that started before a language switch still reports the old grammar; it must not paint.
    if (next.languageId != languageId) {
      engine?.release(next) ?: next.close()
      return
    }
    snapshot?.let { engine?.release(it) ?: it.close() }
    snapshot = next
    if (debugSwitch()) {
      val s = next.stats
      Log.i(DebugSwitch.TAG, "{\"call\":\"parse\",\"ms\":${s.latencyMillis},\"fresh\":${s.freshInjections},\"reused\":${s.reusedInjections},\"carried\":${s.carriedInjections}}")
    }
    invalidate()
  }

  private fun rowMetrics(): RowMetrics = metrics ?: RowMetrics(paint, lineHeight, core.settings.tabSize).also {
    metrics = it
    viewport.rowHeight = it.rowHeight
  }

  private fun dp(value: Float): Int = Math.round(value * density)

  // Line reads for the geometry: from the frame while a draw runs, else one core call. Neither goes through the
  // document's checked members.
  private fun docLineAt(offset: Int): Int = drawFrame?.lineAt(offset) ?: CoreNative.docLineAt(core.document.handle, offset)

  private fun docLineStart(line: Int): Int = drawFrame?.lineStart(line) ?: CoreNative.docLineStart(core.document.handle, line)

  private fun docLineLength(line: Int): Int = drawFrame?.lineLength(line) ?: core.document.handle.let { h ->
    CoreNative.docLineEnd(h, line) - CoreNative.docLineStart(h, line)
  }

  /** Lays out one line plain, for hit tests and reveals on lines outside the drawn range. */
  private fun layoutLine(line: Int): Entry {
    val frame = drawFrame
    val spans = keptSpans(line, frame?.revision ?: core.document.revision)
    val text = frame?.text(line) ?: core.document.lineOutsideFrame(line)
    val layout = LineLayout(text, spans, paint, theme, viewport.wrapWidth, core.settings.tabSize, rowMetrics())
    val entry = Entry(layout, spans, -1)
    cache.put(line, entry)
    viewport.measured(line, layout.rowCount, offeredWidth(layout))
    return entry
  }

  /** The width a layout offers as the widest line, or -1 while wrapping. */
  private fun offeredWidth(layout: LineLayout): Int = if (viewport.wrap) -1 else Math.round(layout.width())

  private fun onScrolled() {
    anchorDirty = true
    hideInsertionHandle()
    menu.invalidateContentRect()
    scrollDirty = true
    invalidate()
  }

  private fun scrollByTouch(dx: Float, dy: Float) {
    val rx = Math.round(dx)
    val ry = Math.round(dy)
    val moved = viewport.scrollBy(rx, ry)
    val s = viewport.lastScroll
    val overX = if (s.maxX > 0) rx - s.dx else 0
    val overY = if (s.maxY > 0) ry - s.dy else 0
    if (overX != 0 || overY != 0) scroller.pull(overX.toFloat(), overY.toFloat(), touchX, touchY, width, height)
    if (moved) onScrolled()
  }

  private fun fling(velocityX: Float, velocityY: Float) {
    val min = viewConfig.scaledMinimumFlingVelocity
    val s = viewport.scroll()
    val vx = if (abs(velocityX) > min && s.maxX > 0) -velocityX.toInt() else 0
    val vy = if (abs(velocityY) > min && s.maxY > 0) -velocityY.toInt() else 0
    if (vx == 0 && vy == 0) return
    scroller.fling(s.x, s.y, vx, vy, s.maxX, s.maxY)
  }

  /** Shows the caret at once and restarts the blink cycle. Runs on focus, edits and caret moves. */
  private fun restartBlink() {
    removeCallbacks(blink)
    caretVisible = true
    if (isFocused && isAttachedToWindow) postDelayed(blink, CARET_BLINK_MS)
    invalidate()
  }

  private fun showInsertionHandle() {
    handles.insertionVisible = true
    removeCallbacks(hideInsertion)
    postDelayed(hideInsertion, INSERTION_HANDLE_MS)
    invalidate()
  }

  private fun hideInsertionHandle() {
    removeCallbacks(hideInsertion)
    if (handles.insertionVisible) {
      handles.insertionVisible = false
      invalidate()
    }
  }

  /** View coordinates of the bottom of the caret row at [offset]. False when that line is not laid out. */
  private fun anchorAt(offset: Int, m: RowMetrics): Boolean {
    val line = docLineAt(offset)
    val entry = cache[line] ?: return false
    anchorTo(line, offset, entry, m)
    return true
  }

  private fun anchorTo(line: Int, offset: Int, entry: Entry, m: RowMetrics) {
    val col = offset - docLineStart(line)
    val row = entry.layout.rowOf(col)
    anchorX = viewport.viewX(entry.layout.caretX(col))
    anchorY = (viewport.lineTop(line) + (row + 1) * m.rowHeight).toFloat()
  }

  private fun placeHandles(m: RowMetrics) {
    val sel = core.selection
    handles.selectionVisible = !sel.isEmpty
    if (sel.isEmpty) {
      handles.hideStart()
      handles.hideEnd()
      if (anchorAt(sel.head, m)) handles.placeInsertion(anchorX, anchorY) else handles.hideInsertion()
    } else {
      handles.hideInsertion()
      if (anchorAt(sel.min, m)) handles.placeStart(anchorX, anchorY) else handles.hideStart()
      if (anchorAt(sel.max, m)) handles.placeEnd(anchorX, anchorY) else handles.hideEnd()
    }
  }

  private fun showMagnifier(x: Float, y: Float) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return
    val m = magnifier ?: Magnifier(this).also { magnifier = it }
    m.show(x, y)
  }

  private fun dismissMagnifier() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) magnifier?.dismiss()
  }

  internal fun onImeBatchEnded() {
    invalidate()
  }

  internal fun requestCursorUpdates(mode: Int) {
    if (bridge.requestCursorUpdates(mode)) {
      cursorUpdateOnce = true
      invalidate()
    }
  }

  internal fun insertNewlineFromIme(): Boolean {
    if (isReadOnly) return false
    ime.finishComposingText()
    core.insertNewline()
    return true
  }

  /** Remembers when input arrived so the next draw can log its latency, while the debug setting is on. */
  internal fun markInputTime(time: Long = SystemClock.uptimeMillis()) {
    if (inputTime == 0L && debugSwitch()) inputTime = time
  }

  /** Adds the time a key handler or keyboard call spends on the main thread to the next paint line. */
  internal fun <T> inputWork(block: () -> T): T {
    val started = SystemClock.uptimeMillis()
    try {
      return block()
    } finally {
      if (inputTime != 0L) inputWork += SystemClock.uptimeMillis() - started
    }
  }

  /** The document as the recorder logs it after each keyboard call. */
  internal fun imeState(): JSONObject {
    val sel = core.selection
    val comp = ime.composing
    val state = JSONObject()
      .put("sel", JSONArray().put(sel.anchor).put(sel.head))
      .put("comp", if (comp == null) JSONObject.NULL else JSONArray().put(comp.start).put(comp.end))
      .put("len", core.document.length)
    if (core.document.length <= RECORD_TEXT_LIMIT) state.put("text", core.document.text())
    return state
  }

  // Re-read at most once a second, so the setting can be flipped while the editor stays focused.
  private fun debugSwitch(): Boolean {
    val now = SystemClock.uptimeMillis()
    if (now - debugChecked > 1000) {
      debugChecked = now
      debugOn = DebugSwitch.isOn(context)
    }
    return debugOn
  }

  private fun restartInput() {
    ime.reset()
    if (isFocused) bridge.restartInput()
  }

  private fun showKeyboard() {
    if (!isReadOnly && isFocused) bridge.showKeyboard()
  }

  private fun runAutoFocus() {
    autoFocusPending = false
    post { focus() }
  }

  private fun flushIme(m: RowMetrics) {
    if (imeDirty && ime.batchDepth == 0) {
      imeDirty = false
      // Taps and hardware keys move the caret without a keyboard call; a replay needs that line.
      if (externalSelection) {
        externalSelection = false
        recorder?.logSelection(core.selection)
      }
      if (isFocused) bridge.updateSelection(core.selection, ime.composing)
    }
    if (cursorUpdateOnce || (anchorDirty && bridge.monitorsCursor)) {
      cursorUpdateOnce = false
      anchorDirty = false
      if (isFocused) sendCursorAnchorInfo(m)
    }
    if (inputTime != 0L) {
      Log.i(DebugSwitch.TAG, "{\"call\":\"paint\",\"latency\":${SystemClock.uptimeMillis() - inputTime},\"work\":${inputWork + SystemClock.uptimeMillis() - drawStart}}")
      inputWork = 0L
      inputTime = 0L
    }
  }

  private fun sendCursorAnchorInfo(m: RowMetrics) {
    val doc = core.document
    val sel = core.selection
    val caret = caretRect(m, doc.lineAt(sel.head))
    val baseline = caret?.let { it.top - m.ascent } ?: 0f
    val range = ime.composing
    val bounds = ArrayList<RectF>()
    var text: String? = null
    if (range != null) {
      val line = doc.lineAt(range.start)
      val entry = cache[line]
      if (entry != null && doc.lineAt(range.end) == line) {
        text = doc.text(range.start, range.end)
        val ls = doc.lineStart(line)
        val lineTop = viewport.lineTop(line)
        for (i in range.start until range.end) {
          val col = i - ls
          val top = (lineTop + entry.layout.rowOf(col) * m.rowHeight).toFloat()
          val left = viewport.viewX(entry.layout.caretX(col))
          val right = viewport.viewX(entry.layout.caretX(col + 1))
          bounds.add(RectF(minOf(left, right), top, maxOf(left, right), top + m.rowHeight))
        }
      }
    }
    bridge.sendCursorAnchorInfo(sel, caret, baseline, range?.start ?: -1, text, bounds)
  }

  /** Bounds of the selection ends, or the caret, for anchoring the floating menu. Ends off screen keep their real position so the toolbar hides with them. */
  private fun selectionRect(out: Rect) {
    val m = rowMetrics()
    val sel = core.selection
    endRect(sel.min, m, out)
    if (!sel.isEmpty) {
      val end = Rect()
      endRect(sel.max, m, end)
      out.union(end)
    }
  }

  private fun endRect(offset: Int, m: RowMetrics, out: Rect) {
    val line = core.document.lineAt(offset)
    anchorTo(line, offset, cache[line] ?: layoutLine(line), m)
    out.set(anchorX.toInt(), (anchorY - m.rowHeight).toInt(), anchorX.toInt() + 1, anchorY.toInt())
  }

  private inner class MenuHost : EditMenu.Host {
    override fun contentRect(out: Rect) = selectionRect(out)

    override fun canCut(): Boolean = !isReadOnly && !core.selection.isEmpty

    override fun canCopy(): Boolean = !core.selection.isEmpty

    override fun canPaste(): Boolean = !isReadOnly && clipboard.text() != null

    override fun cut() = this@CodeEditorView.cut()

    override fun copy() {
      this@CodeEditorView.copy()
    }

    override fun paste() = this@CodeEditorView.paste()

    override fun selectAll() = this@CodeEditorView.selectAll()
  }

  private inner class GestureHost : GestureMachine.Host {
    override fun offsetAt(x: Float, y: Float): Int = this@CodeEditorView.offsetAt(x, y)

    override fun inGap(x: Float, y: Float): Boolean = viewport.isGapRow(viewport.rowAt(y.toInt()))

    // Runs on touch down, so this is where the grab offset and the fixed selection end are captured.
    override fun handleAt(x: Float, y: Float): GestureMachine.Handle? {
      val handle = handles.hitTest(x, y) ?: return null
      grabDy = y - handles.top(handle)
      dragFixed = if (handle == GestureMachine.Handle.Start) core.selection.max else core.selection.min
      return handle
    }

    override fun insideSelection(offset: Int): Boolean {
      val sel = core.selection
      return !sel.isEmpty && offset >= sel.min && offset <= sel.max
    }

    override val scrollsVertically: Boolean get() = isScrollEnabled

    override fun canScroll(dx: Float, dy: Float): Boolean = viewport.canScroll(dx, dy)

    override fun placeCaret(offset: Int) {
      menu.hide()
      requestFocus()
      showKeyboard()
      core.setSelection(offset, offset)
      showInsertionHandle()
    }

    override fun selectWord(offset: Int) {
      requestFocus()
      showKeyboard()
      core.selectWordAt(offset)
      wordAnchor = core.selection.range
    }

    // The word under the long press stays selected and the far end follows the finger by words.
    override fun extendWords(offset: Int) {
      val word = TextMovement.wordRangeAt(core.document, offset)
      if (offset >= wordAnchor.start) {
        core.setSelection(wordAnchor.start, maxOf(word.end, wordAnchor.end))
      } else {
        core.setSelection(wordAnchor.end, word.start)
      }
    }

    override fun moveHandle(handle: GestureMachine.Handle, x: Float, y: Float) {
      menu.hide()
      val textY = y - grabDy - rowMetrics().rowHeight / 2f
      val offset = this@CodeEditorView.offsetAt(x, textY)
      if (handle == GestureMachine.Handle.Insertion) {
        core.setSelection(offset, offset)
        showInsertionHandle()
      } else {
        core.setSelection(dragFixed, offset)
      }
      showMagnifier(x, textY)
    }

    override fun endHandleDrag() {
      dismissMagnifier()
      menu.show()
    }

    override fun beginScroll() {
      menu.hide()
    }

    override fun scrollBy(dx: Float, dy: Float) = scrollByTouch(dx, dy)

    override fun endScroll(velocityX: Float, velocityY: Float) {
      scroller.release()
      fling(velocityX, velocityY)
    }

    override fun showMenu() {
      menu.show()
    }

    override fun disallowIntercept() {
      parent?.requestDisallowInterceptTouchEvent(true)
    }

    override fun holdParent() {
      isNestedScrollingEnabled = true
      startNestedScroll(View.SCROLL_AXIS_VERTICAL)
    }

    override fun releaseParent() {
      stopNestedScroll()
    }

    override fun postLongPress(delayMs: Long) {
      postDelayed(longPressRunnable, delayMs)
    }

    override fun cancelLongPress() {
      removeCallbacks(longPressRunnable)
    }
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    val widthChanged = viewport.resize(w, h)
    cache.capacity = maxOf(64, 3 * (h / rowMetrics().rowHeight + 1))
    scroller.setSize(w, h)
    when {
      widthChanged -> relayout()
      viewport.clamp() -> onScrolled()
      else -> invalidate()
    }
    if (oldh != 0 && isFocused) revealPending = true
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    touchX = event.x
    touchY = event.y
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        velocity?.recycle()
        velocity = VelocityTracker.obtain().also { it.addMovement(event) }
        if (!scroller.isFinished) scroller.abort()
        gestures.down(event.x, event.y, event.eventTime)
      }
      MotionEvent.ACTION_MOVE -> {
        velocity?.addMovement(event)
        gestures.move(event.x, event.y, event.eventTime)
      }
      MotionEvent.ACTION_UP -> {
        var vx = 0f
        var vy = 0f
        velocity?.let {
          it.addMovement(event)
          it.computeCurrentVelocity(1000, viewConfig.scaledMaximumFlingVelocity.toFloat())
          vx = it.xVelocity
          vy = it.yVelocity
          it.recycle()
        }
        velocity = null
        gestures.up(event.x, event.y, event.eventTime, vx, vy)
      }
      MotionEvent.ACTION_CANCEL -> {
        velocity?.recycle()
        velocity = null
        gestures.cancel()
      }
      else -> return super.onTouchEvent(event)
    }
    return true
  }

  override fun computeScroll() {
    if (!scroller.step()) return
    val start = System.nanoTime()
    // One core call. An axis that moved onto an edge reached it in this step.
    val moved = viewport.scrollTo(scroller.currX, scroller.currY)
    val s = viewport.lastScroll
    if (moved) onScrolled()
    val v = scroller.currVelocity.toInt()
    if (scroller.flinging && v > 0) {
      val movedX = s.axes and 1 != 0
      val movedY = s.axes and 2 != 0
      if (movedY && s.y == 0) scroller.absorbTop(v)
      if (movedY && s.y == s.maxY) scroller.absorbBottom(v)
      if (movedX && s.x == 0) scroller.absorbLeft(v)
      if (movedX && s.x == s.maxX) scroller.absorbRight(v)
    }
    if (moved && debugSwitch()) Log.i(DebugSwitch.TAG, "{\"call\":\"fling\",\"us\":${(System.nanoTime() - start) / 1000}}")
    postInvalidateOnAnimation()
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
    if (!handlesKey(keyCode, event)) return super.onKeyDown(keyCode, event)
    val command = KeyCommands.map(keyCode, event.metaState)
    if (command?.edits == true && isReadOnly) return true
    markInputTime(event.eventTime)
    inputWork {
      if (command != null) {
        perform(command)
      } else {
        ime.finishComposingText()
        core.typeText(String(Character.toChars(event.unicodeChar)))
      }
    }
    return true
  }

  // An unconsumed key up reaches the activity, where the RN debug client reloads JS on a double R.
  override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean = handlesKey(keyCode, event) || super.onKeyUp(keyCode, event)

  private fun handlesKey(keyCode: Int, event: KeyEvent): Boolean {
    if (KeyCommands.map(keyCode, event.metaState) != null) return true
    if (isReadOnly || event.isCtrlPressed || event.isAltPressed || event.isMetaPressed) return false
    val ch = event.unicodeChar
    return ch != 0 && ch and KeyCharacterMap.COMBINING_ACCENT == 0
  }

  /** Types through the keyboard path: auto closing, the indenter on a newline, typing coalescing. */
  fun typeText(text: String) {
    if (isReadOnly || text.isEmpty()) return
    ime.finishComposingText()
    core.typeText(text)
    revealPending = true
    invalidate()
  }

  // View.post on a detached view waits for an attach that never comes after an unmount.
  fun runOnMain(block: () -> Unit) {
    mainHandler.post(block)
  }

  fun perform(command: KeyCommand) {
    if (command.edits && isReadOnly) return
    if (command.edits) ime.finishComposingText()
    when (command) {
      is KeyCommand.Vertical -> moveVertically(command)
      KeyCommand.Copy -> copy()
      KeyCommand.Cut -> cut()
      KeyCommand.Paste -> paste()
      KeyCommand.Undo -> undo()
      KeyCommand.Redo -> redo()
      else -> CoreCommands.run(core, command)
    }
    revealPending = true
    invalidate()
  }

  private fun moveVertically(command: KeyCommand.Vertical) {
    val m = rowMetrics()
    val rows = if (command.page) maxOf(1, viewport.viewportHeight / m.rowHeight) else 1
    val result = CaretMover.move(core.document, geometry, core.selection.head, rows * command.direction, goalX)
    movingVertically = true
    core.setSelection(if (command.extend) core.selection.anchor else result.offset, result.offset)
    movingVertically = false
    goalX = result.goalX
  }

  override fun onCheckIsTextEditor(): Boolean = !isReadOnly

  override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
    if (isReadOnly) return null
    bridge.fillEditorInfo(outAttrs, suggestions, placeholder, core.selection, ime.window(EDITOR_INFO_WINDOW, EDITOR_INFO_WINDOW))
    lastInputType = outAttrs.inputType
    recording = debugSwitch()
    val connection = EditorInputConnection(this)
    recorder = if (recording) RecordingInputConnection(connection, this) else null
    return recorder ?: connection
  }

  override fun onFocusChanged(gainFocus: Boolean, direction: Int, previouslyFocusedRect: Rect?) {
    super.onFocusChanged(gainFocus, direction, previouslyFocusedRect)
    focused = gainFocus
    if (gainFocus) {
      restartBlink()
    } else {
      ime.reset()
      removeCallbacks(blink)
      invalidate()
    }
    onFocusListener?.invoke(gainFocus)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (dropped) return
    engine()
    if (avoidsKeyboard) startKeyboardTracker()
    if (autoFocusPending) runAutoFocus()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    stopKeyboardTracker()
    removeCallbacks(longPressRunnable)
    removeCallbacks(blink)
    removeCallbacks(hideInsertion)
    dismissMagnifier()
    menu.hide()
    ime.reset()
    scroller.abort()
    engine?.close()
    engine = null
    search?.close()
    search = null
    snapshot?.close()
    snapshot = null
    if (dropped) {
      core.close()
      viewport.close()
      coreReleased = true
    }
  }

  /**
   * Unmount: the view never draws again. The core is freed once the view is also off the window, since the keyboard
   * still calls its connection until then.
   */
  fun close() {
    dropped = true
    if (!isAttachedToWindow) release()
  }

  private fun release() {
    engine?.close()
    engine = null
    search?.close()
    search = null
    snapshot?.close()
    snapshot = null
    core.close()
    viewport.close()
    coreReleased = true
  }

  override fun onDraw(canvas: Canvas) {
    if (dropped) return
    drawStart = SystemClock.uptimeMillis()
    val drawNanos = System.nanoTime()
    // React Native parents leave clipChildren off, so an unclipped drawColor would cover siblings.
    canvas.clipRect(0, 0, width, height)
    canvas.drawColor(theme.background)
    if (width == 0 || height == 0) return
    val m = rowMetrics()
    // The layout's two calls of a draw: the frame, then the measure call in prepare. Until endDraw, the layout reads
    // come from them. With the debug switch on, a ninth single call throws.
    viewport.beginDraw(checksCalls = debugSwitch())
    if (revealPending) {
      revealPending = false
      revealSelection()
    }
    // One core call for the document. Until publish returns, every document read comes from it.
    var f = readFrame()
    drawFrame = f
    if (debugSwitch()) core.document.drawingThread = Thread.currentThread()
    prepare(f, m)
    // A measure call that clamps the scroll (a visible line lost rows at the end) shows lines above the frame. They
    // are laid out in this draw too, so none of them shows blank.
    if (viewport.firstVisibleLine() < f.first) {
      f = readFrame()
      drawFrame = f
      prepare(f, m)
    }
    val firstLine = f.first
    val lastBound = f.last
    val caretLine = f.caretLine
    val caretOnly = f.anchor == f.head
    if (highlightActiveLine && caretOnly && caretLine in firstLine..lastBound) {
      painter.drawActiveLine(canvas, caretLine, width, height)
    }
    val decorated = core.decorations.items
    if (decorated.isNotEmpty()) {
      decorationPainter.drawLineBackgrounds(canvas, decorated, viewport, firstLine, lastBound, width, height)
    }
    drawFills(canvas, f, firstLine, lastBound)
    if (decorated.isNotEmpty()) {
      val windowEnd = docLineStart(lastBound) + docLineLength(lastBound)
      clippedToText(canvas) {
        decorationPainter.drawUnderlines(canvas, decorated, rowGeometry, firstLine, windowEnd, -m.ascent)
      }
    }
    val lastLine = painter.drawText(canvas, f.lineCount, firstLine, width, height)
    drawComposing(canvas, firstLine)
    if (lineNumbers) painter.drawGutter(canvas, m, firstLine, lastLine, caretLine, height)
    if (isFocused && caretVisible && caretOnly) caretRect(m, caretLine)?.let { painter.drawCaret(canvas, it, height) }
    placeHandles(m)
    handles.draw(canvas)
    placeholder?.let { if (f.length == 0) painter.drawPlaceholder(canvas, m, it) }
    if (scroller.draw(canvas, width, height)) postInvalidateOnAnimation()
    publish(firstLine, lastLine, caretLine, m)
    viewport.endDraw()
    core.document.drawingThread = null
    drawFrame = null
    flushIme(m)
    val scrolled = scrollDirty
    if (scrollDirty) {
      scrollDirty = false
      onScrollListener?.invoke(frame)
    }
    if (contentDirty) {
      contentDirty = false
      onContentSizeListener?.invoke(lastContentWidth, lastContentHeight)
    }
    if (gapsDirty) {
      gapsDirty = false
      onGapLayoutListener?.invoke(frame.gaps)
    }
    if (selectionDirty) {
      selectionDirty = false
      onSelectionListener?.invoke(core.selection)
    }
    if (!drawn) {
      drawn = true
      onFirstDraw?.let { post(it) }
    }
    if (scrolled && debugSwitch()) Log.i(DebugSwitch.TAG, "{\"call\":\"draw\",\"us\":${(System.nanoTime() - drawNanos) / 1000}}")
  }

  /**
   * Builds missing layouts for [first, last] with one highlight query per run of dirty lines: when the snapshot follows
   * the one last applied, only the lines its regions meet; otherwise every line not at its revision.
   */
  private fun readFrame(): EditorFrame {
    val usable = if (highlighter != null) snapshot else null
    if (framePairs.size < 2 * cache.size) framePairs = IntArray(2 * maxOf(cache.size, cache.capacity))
    var n = 0
    cache.forEachEntry { line, entry ->
      framePairs[2 * n] = line
      framePairs[2 * n + 1] = entry.revision
      n++
    }
    val incremental = usable != null && usable.basedOn >= 0 && usable.basedOn == appliedRevision
    return frameReader.read(core, viewport, usable?.pointer ?: 0L, appliedRevision, incremental, framePairs, n)
  }

  /** Ends with the draw's measure call, which takes the rows of every line laid out here and the widest one. */
  private fun prepare(frame: EditorFrame, m: RowMetrics) {
    // The core paints from the snapshot only when it is at the frame's revision. Otherwise its runs are the lines
    // with no layout, and those take the spans keepSpans kept.
    val consistent = highlighter != null && snapshot?.revision == frame.revision
    val revision = if (consistent) frame.revision else -1
    val runs = frame.runs
    var count = 0
    var widest = -1
    var r = 0
    // A run line's insert evicts the oldest layout, which must not be a frame line the loop has not reached yet.
    for (line in frame.first..frame.last) cache[line]
    // The spans and text of the run lines arrive in line order, one entry per line.
    var next = 0
    for (line in frame.first..frame.last) {
      while (r + 1 < runs.size && runs[r + 1] < line) r += 2
      val inRun = r + 1 < runs.size && line >= runs[r]
      val entry = cache[line]
      if (!inRun) {
        // A clean line keeps its layout and takes the revision without a query. Every line without one is in a run.
        if (entry != null && revision >= 0) entry.revision = revision
        continue
      }
      val lineSpans = frame.spans.getOrNull(next)
      next++
      val fresh: IntArray?
      if (consistent) {
        fresh = lineSpans?.takeIf { it.isNotEmpty() }
        if (entry != null && entry.spans.contentEquals(fresh)) {
          entry.revision = revision
          continue
        }
      } else {
        fresh = keptSpans(line, frame.revision)
      }
      val layout = LineLayout(frame.text(line) ?: "", fresh, paint, theme, viewport.wrapWidth, core.settings.tabSize, m)
      cache.put(line, Entry(layout, fresh, if (consistent) revision else -1))
      if (2 * count + 2 > measurePairs.size) measurePairs = measurePairs.copyOf(2 * measurePairs.size)
      measurePairs[2 * count] = line
      measurePairs[2 * count + 1] = layout.rowCount
      count++
      widest = maxOf(widest, offeredWidth(layout))
    }
    if (revision >= 0) {
      appliedRevision = revision
      pendingSpans = null
      pendingTail = null
    }
    viewport.measure(measurePairs, count, widest, frame.first, frame.last)
  }

  /** The spans [keepSpans] kept for a line of [revision], the current one, or null. */
  private fun keptSpans(line: Int, revision: Int): IntArray? = when {
    pendingRevision != revision -> null
    line == pendingLine -> pendingSpans
    line == pendingLine + 1 -> pendingTail
    else -> null
  }

  /** The edited line's previous spans moved along a change that stays inside it, or split by a typed newline. */
  private fun keepSpans(first: Int, oldCount: Int, newCount: Int, change: Change) {
    pendingSpans = null
    pendingTail = null
    if (oldCount != 1) return
    val spans = cache[first]?.spans ?: return
    val doc = core.document
    val column = change.start - doc.lineStart(first)
    pendingSpans = when {
      newCount == 1 -> shiftSpans(spans, column, change.removed.length, change.inserted.length)
      newCount == 2 && change.removed.isEmpty() && change.inserted.startsWith("\n") -> {
        val added = change.inserted.length - 1
        pendingTail = shiftSpans(spans, 0, column, added)
        shiftSpans(spans, column, doc.lineLength(first + 1) - added, 0)
      }
      else -> return
    }
    pendingLine = first
    pendingRevision = doc.revision
  }

  /** Fills under the text in this order: search matches, bracket pair, selection. */
  private fun drawFills(canvas: Canvas, frame: EditorFrame, firstLine: Int, lastLine: Int) {
    canvas.save()
    canvas.clipRect(viewport.textAreaLeft, 0, width, height)
    search?.takeIf { it.active }?.let {
      val window = Range(docLineStart(firstLine), docLineStart(lastLine + 1) - 1)
      val active = core.selection.range.takeIf { r -> !r.isEmpty }
      decorations.drawMatches(canvas, rowGeometry, it.matchesForPaint(), active, firstLine, window, theme.searchMatch, theme.searchMatchActive)
    }
    val consistent = snapshot?.takeIf { it.revision == frame.revision }
    brackets.pair(consistent, frame.revision, frame.head)?.let {
      decorations.drawBrackets(canvas, rowGeometry, it, firstLine, theme.matchingBracket)
    }
    val sel = core.selection
    if (!sel.isEmpty) decorations.drawRange(canvas, rowGeometry, sel.min, sel.max, firstLine, theme.selection)
    canvas.restore()
  }

  private fun drawComposing(canvas: Canvas, firstLine: Int) {
    val range = ime.composing ?: return
    clippedToText(canvas) {
      decorations.drawUnderline(canvas, rowGeometry, range.start, range.end, firstLine, theme.foreground, maxOf(1, dp(1f)).toFloat())
    }
  }

  private inline fun clippedToText(canvas: Canvas, block: () -> Unit) {
    canvas.save()
    canvas.clipRect(viewport.textAreaLeft, 0, width, height)
    block()
    canvas.restore()
  }

  private fun caretRect(m: RowMetrics, line: Int): RectF? = painter.caretRect(m, line, core.selection.head - docLineStart(line))

  /** Every gap in view dp, sorted by line, the full view width wide. */
  private fun gapRects(m: RowMetrics): List<GapRect> = viewport.gaps().map { gap ->
    val top = gap.top.toFloat()
    GapRect(gap.line, RectF(0f, top / density, width / density, (top + gap.rows * m.rowHeight) / density))
  }

  /** The gap under [line] in view dp from the last frame, or null. */
  fun gapRect(line: Int): RectF? = frame.gaps.firstOrNull { it.line == line }?.rect

  private fun publish(firstLine: Int, lastLine: Int, caretLine: Int, m: RowMetrics) {
    val caret = caretRect(m, caretLine)?.let { RectF(it.left / density, it.top / density, it.right / density, it.bottom / density) }
    val gaps = gapRects(m)
    if (gaps != frame.gaps) gapsDirty = true
    frame = FrameInfo(
      firstLine,
      lastLine,
      caret,
      viewport.scrollX / density,
      viewport.scrollY / density,
      viewport.contentWidth / density,
      viewport.contentHeight / density,
      gaps,
    )
    val w = (viewport.textAreaLeft + viewport.contentWidth + viewport.insetRight) / density
    val h = (viewport.insetTop + viewport.contentHeight + viewport.insetBottom - keyboardInset) / density
    if (w != lastContentWidth || h != lastContentHeight) {
      lastContentWidth = w
      lastContentHeight = h
      contentDirty = true
    }
  }

  companion object {
    // Without linear text, hinting snaps plain runs to whole pixel advances and draws faked italics at the floored size.
    private const val TEXT_FLAGS = Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG or Paint.LINEAR_TEXT_FLAG
    private const val TEXT_PADDING_DP = 8f
    private const val CARET_BLINK_MS = 500L
    private const val INSERTION_HANDLE_MS = 4000L
    private const val EDITOR_INFO_WINDOW = 2048
    private const val RECORD_TEXT_LIMIT = 1500
  }
}
