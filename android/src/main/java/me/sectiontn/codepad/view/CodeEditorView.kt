package me.sectiontn.codepad.view

import android.content.ClipData
import android.content.ClipboardManager
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
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.View
import android.view.ViewConfiguration
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.widget.Magnifier
import me.sectiontn.codepad.core.Change
import me.sectiontn.codepad.core.ChangeOrigin
import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.core.EditorSettings
import me.sectiontn.codepad.core.Range
import me.sectiontn.codepad.core.Selection
import me.sectiontn.codepad.core.TextMovement
import me.sectiontn.codepad.input.ImeSession
import me.sectiontn.codepad.layout.GutterMetrics
import me.sectiontn.codepad.layout.HeightMap
import me.sectiontn.codepad.layout.LayoutCache
import me.sectiontn.codepad.layout.LineLayout
import me.sectiontn.codepad.layout.RowMetrics
import me.sectiontn.codepad.layout.Viewport
import me.sectiontn.codepad.syntax.Highlighter
import me.sectiontn.codepad.syntax.LanguageRegistry
import me.sectiontn.codepad.syntax.Snapshot
import me.sectiontn.codepad.syntax.SyntaxEngine
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

  var isScrollEnabled = true
    private set

  var isReadOnly = false
    private set

  // revision is the snapshot the spans came from, -1 when the line was laid out plain.
  private class Entry(val layout: LineLayout, val spans: IntArray?, var revision: Int)

  private val density = resources.displayMetrics.density
  private val mainHandler = Handler(Looper.getMainLooper())
  private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG)
  private val gutterPaint = TextPaint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG)
  private val fill = Paint()
  private var theme: ThemeColors = ThemeColors.default
  private var lineHeight = 1.4f
  private var languageId: String? = null
  private var metrics: RowMetrics? = null
  private var snapshot: Snapshot? = null
  private var highlighter: Highlighter? = null
  private var engine: SyntaxEngine? = null

  private var heights = HeightMap(1)
  private val viewport = Viewport(heights)
  private val cache = LayoutCache<Entry>(64)

  private var lineNumbers = true
  private var highlightActiveLine = true
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
  private var grabDy = 0f
  private var dragFixed = 0
  private var anchorX = 0f
  private var anchorY = 0f
  private val blink = object : Runnable {
    override fun run() {
      caretVisible = !caretVisible
      invalidate()
      postDelayed(this, CARET_BLINK_MS)
    }
  }
  private val hideInsertion = Runnable {
    handles.insertionVisible = false
    invalidate()
  }
  private val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
  private val menu = EditMenu(this, MenuHost())

  var onFocusListener: ((Boolean) -> Unit)? = null
  var onChangeListener: ((Change, ChangeOrigin) -> Unit)? = null

  // Read on the JS thread by isFocused().
  @Volatile
  var focused = false
    private set

  var ime = ImeSession(core)
    private set
  val composing: Range? get() = ime.composing

  var lastInputType = 0
    private set

  private val bridge = InputMethodBridge(this)
  private var suggestions = InputMethodBridge.Suggestions.Off
  private var autoFocusPending = false
  private var imeDirty = false
  private var anchorDirty = false
  private var cursorUpdateOnce = false
  private var revealPending = false
  private var inputTime = 0L
  private var debugOn = false
  private var debugChecked = 0L

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
    core = EditorCore(value).also { it.settings = settings }
    wire(core)
    engine().setText(value, core.document.revision)
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
    cache.clear()
    invalidate()
  }

  fun setTheme(colors: ThemeColors) {
    theme = colors
    paint.color = colors.foreground
    scroller.setColor(colors.foreground)
    handles.setColor(colors.cursor)
    cache.clear()
    invalidate()
  }

  fun setFont(family: String?, sizeDp: Float, lineHeightMultiplier: Float) {
    lineHeight = lineHeightMultiplier
    applyFont(family?.let { typefaceResolver?.invoke(it) } ?: Typeface.MONOSPACE, sizeDp)
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

  /** Insets in dp. The bottom inset is how consumers keep the caret above the keyboard. */
  fun setContentInsets(top: Float, bottom: Float, left: Float, right: Float) {
    viewport.insetTop = dp(top)
    viewport.insetBottom = dp(bottom)
    viewport.insetLeft = dp(left)
    viewport.insetRight = dp(right)
    relayout()
  }

  fun setScrollEnabled(enabled: Boolean) {
    isScrollEnabled = enabled
  }

  fun scrollToLine(line: Int, animated: Boolean) {
    val target = heights.rowStart(line.coerceIn(0, core.document.lineCount - 1)) * viewport.rowHeight
    scroller.abort()
    if (animated) {
      scroller.animateTo(viewport.scrollX, viewport.scrollY, viewport.scrollX, target.coerceIn(0, viewport.maxScrollY))
    } else if (viewport.scrollTo(viewport.scrollX, target)) {
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
    val top = (heights.rowStart(line) + row) * m.rowHeight
    scroller.abort()
    if (viewport.reveal(x, top, x + dp(CARET_WIDTH_DP), top + m.rowHeight)) onScrolled()
  }

  /** Document offset under a view point. Points left of the text snap to the row start, points below to the end. */
  fun offsetAt(x: Float, y: Float): Int {
    val doc = core.document
    val row = viewport.rowAt(y.toInt())
    if (row < 0) return 0
    if (row >= heights.totalRows) return doc.length
    val line = heights.lineAtRow(row)
    val entry = cache[line] ?: layoutLine(line)
    val rowInLine = (row - heights.rowStart(line)).coerceIn(0, entry.layout.rowCount - 1)
    return doc.lineStart(line) + entry.layout.columnAt(rowInLine, viewport.contentX(x))
  }

  fun copy(): Boolean {
    val sel = core.selection
    if (sel.isEmpty) return false
    clipboard.setPrimaryClip(ClipData.newPlainText("text", core.document.text(sel.min, sel.max)))
    return true
  }

  fun cut(origin: ChangeOrigin = ChangeOrigin.Input) {
    if (isReadOnly || !copy()) return
    val sel = core.selection
    if (origin == ChangeOrigin.Api) core.replace(sel.min, sel.max, "", origin) else core.delete()
  }

  fun paste(origin: ChangeOrigin = ChangeOrigin.Input) {
    if (isReadOnly) return
    val text = clipboardText() ?: return
    core.insertText(text, origin)
    revealSelection()
  }

  fun selectAll() {
    core.selectAll()
    menu.invalidateContentRect()
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
    ime = ImeSession(core)
  }

  private fun onSelectionMoved() {
    selectionDirty = true
    imeDirty = true
    anchorDirty = true
    restartBlink()
  }

  private fun onDocumentChange(change: Change, origin: ChangeOrigin) {
    val doc = core.document
    val first = doc.lineAt(change.start)
    val oldCount = lineSpan(change.removed)
    val newCount = lineSpan(change.inserted)
    heights.replaceLines(first, oldCount, newCount)
    cache.shift(first, oldCount, newCount)
    engine().edit(change, SyntaxEngine.pointsFor(doc, change))
    if (updateGutter()) relayout() else viewport.clamp()
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

  private fun resetDocument() {
    heights = HeightMap(core.document.lineCount)
    viewport.heights = heights
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
    viewport.rowHeight = rowMetrics().rowHeight
    cache.clear()
    heights.resetAll()
    viewport.widestLine = 0
    updateGutter()
    viewport.restore(anchor)
    invalidate()
  }

  private fun updateGutter(): Boolean {
    val w = if (lineNumbers) {
      GutterMetrics.width(core.document.lineCount, paint.measureText("0"), dp(GUTTER_PADDING_DP).toFloat())
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
    it.setText(core.document.text(), core.document.revision)
  }

  private fun onSnapshot(next: Snapshot) {
    snapshot?.close()
    snapshot = next
    invalidate()
  }

  private fun rowMetrics(): RowMetrics = metrics ?: RowMetrics(paint, lineHeight, core.settings.tabSize).also {
    metrics = it
    viewport.rowHeight = it.rowHeight
  }

  private fun dp(value: Float): Int = Math.round(value * density)

  /** Lays out one line plain, for hit tests and reveals on lines outside the drawn range. */
  private fun layoutLine(line: Int): Entry {
    val layout = LineLayout(core.document.line(line), null, paint, theme, viewport.wrapWidth, core.settings.tabSize, rowMetrics())
    val entry = Entry(layout, null, -1)
    cache.put(line, entry)
    viewport.measured(line, layout.rowCount)
    return entry
  }

  private fun onScrolled() {
    anchorDirty = true
    hideInsertionHandle()
    menu.invalidateContentRect()
    scrollDirty = true
    invalidate()
  }

  private fun scrollByTouch(dx: Float, dy: Float) {
    val oldX = viewport.scrollX
    val oldY = viewport.scrollY
    val rx = Math.round(dx)
    val ry = Math.round(dy)
    viewport.scrollBy(rx, ry)
    val overX = if (viewport.maxScrollX > 0) rx - (viewport.scrollX - oldX) else 0
    val overY = if (viewport.maxScrollY > 0) ry - (viewport.scrollY - oldY) else 0
    if (overX != 0 || overY != 0) scroller.pull(overX.toFloat(), overY.toFloat(), touchX, touchY, width, height)
    if (oldX != viewport.scrollX || oldY != viewport.scrollY) onScrolled()
  }

  private fun fling(velocityX: Float, velocityY: Float) {
    val min = viewConfig.scaledMinimumFlingVelocity
    val vx = if (abs(velocityX) > min && viewport.maxScrollX > 0) -velocityX.toInt() else 0
    val vy = if (abs(velocityY) > min && viewport.maxScrollY > 0) -velocityY.toInt() else 0
    if (vx == 0 && vy == 0) return
    scroller.fling(viewport.scrollX, viewport.scrollY, vx, vy, viewport.maxScrollX, viewport.maxScrollY)
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
    val line = core.document.lineAt(offset)
    val entry = cache[line] ?: return false
    anchorTo(line, offset, entry, m)
    return true
  }

  private fun anchorTo(line: Int, offset: Int, entry: Entry, m: RowMetrics) {
    val col = offset - core.document.lineStart(line)
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
      if (isFocused) bridge.updateSelection(core.selection, ime.composing)
    }
    if (cursorUpdateOnce || (anchorDirty && bridge.monitorsCursor)) {
      cursorUpdateOnce = false
      anchorDirty = false
      if (isFocused) sendCursorAnchorInfo(m)
    }
    if (inputTime != 0L) {
      Log.i(DebugSwitch.TAG, "{\"call\":\"paint\",\"latency\":${SystemClock.uptimeMillis() - inputTime}}")
      inputTime = 0L
    }
  }

  private fun sendCursorAnchorInfo(m: RowMetrics) {
    val doc = core.document
    val sel = core.selection
    val caretLine = doc.lineAt(sel.head)
    var caret: RectF? = null
    var baseline = 0f
    cache[caretLine]?.let { entry ->
      val col = sel.head - doc.lineStart(caretLine)
      val row = entry.layout.rowOf(col)
      val x = viewport.viewX(entry.layout.caretX(col))
      val top = (viewport.lineTop(caretLine) + row * m.rowHeight).toFloat()
      caret = RectF(x, top, x + dp(CARET_WIDTH_DP), top + m.rowHeight)
      baseline = top - m.ascent
    }
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

  private fun clipboardText(): String? {
    val clip = clipboard.primaryClip ?: return null
    if (clip.itemCount == 0) return null
    return clip.getItemAt(0).coerceToText(context)?.toString()?.takeIf { it.isNotEmpty() }
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

    override fun canPaste(): Boolean = !isReadOnly && clipboardText() != null

    override fun cut() = this@CodeEditorView.cut()

    override fun copy() {
      this@CodeEditorView.copy()
    }

    override fun paste() = this@CodeEditorView.paste()

    override fun selectAll() = this@CodeEditorView.selectAll()
  }

  private inner class GestureHost : GestureMachine.Host {
    override fun offsetAt(x: Float, y: Float): Int = this@CodeEditorView.offsetAt(x, y)

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

    override fun canScroll(dx: Float, dy: Float): Boolean = isScrollEnabled && viewport.canScroll(dx, dy)

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

    override fun postLongPress(delayMs: Long) {
      postDelayed(longPressRunnable, delayMs)
    }

    override fun cancelLongPress() {
      removeCallbacks(longPressRunnable)
    }
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    viewport.width = w
    viewport.height = h
    cache.capacity = maxOf(64, 3 * (h / rowMetrics().rowHeight + 1))
    scroller.setSize(w, h)
    relayout()
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
    val wasTop = viewport.scrollY == 0
    val wasBottom = viewport.scrollY == viewport.maxScrollY
    val wasLeft = viewport.scrollX == 0
    val wasRight = viewport.scrollX == viewport.maxScrollX
    if (viewport.scrollTo(scroller.currX, scroller.currY)) onScrolled()
    val v = scroller.currVelocity.toInt()
    if (scroller.flinging && v > 0) {
      if (!wasTop && viewport.scrollY == 0) scroller.absorbTop(v)
      if (!wasBottom && viewport.scrollY == viewport.maxScrollY) scroller.absorbBottom(v)
      if (!wasLeft && viewport.scrollX == 0) scroller.absorbLeft(v)
      if (!wasRight && viewport.scrollX == viewport.maxScrollX) scroller.absorbRight(v)
    }
    postInvalidateOnAnimation()
  }

  override fun onCheckIsTextEditor(): Boolean = !isReadOnly

  override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
    if (isReadOnly) return null
    bridge.fillEditorInfo(outAttrs, suggestions, placeholder, core.selection, ime.window(EDITOR_INFO_WINDOW, EDITOR_INFO_WINDOW))
    lastInputType = outAttrs.inputType
    return EditorInputConnection(this)
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
    engine()
    if (autoFocusPending) runAutoFocus()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    removeCallbacks(longPressRunnable)
    removeCallbacks(blink)
    removeCallbacks(hideInsertion)
    dismissMagnifier()
    menu.hide()
    ime.reset()
    scroller.abort()
    engine?.close()
    engine = null
    snapshot?.close()
    snapshot = null
  }

  override fun onDraw(canvas: Canvas) {
    // React Native parents leave clipChildren off, so an unclipped drawColor would cover siblings.
    canvas.clipRect(0, 0, width, height)
    canvas.drawColor(theme.background)
    if (width == 0 || height == 0) return
    val doc = core.document
    val m = rowMetrics()
    if (revealPending) {
      revealPending = false
      revealSelection()
    }
    val firstLine = viewport.firstVisibleLine()
    val lastBound = minOf(doc.lineCount - 1, firstLine + height / m.rowHeight + 1)
    prepare(firstLine, lastBound, m)
    val caretLine = doc.lineAt(core.selection.head)
    drawActiveLine(canvas, caretLine)
    drawSelection(canvas, m, firstLine)
    val lastLine = drawText(canvas, firstLine)
    drawComposing(canvas, m, firstLine)
    drawGutter(canvas, m, firstLine, lastLine, caretLine)
    drawCaret(canvas, m, caretLine)
    placeHandles(m)
    handles.draw(canvas)
    drawPlaceholder(canvas, m)
    if (scroller.draw(canvas, width, height)) postInvalidateOnAnimation()
    publish(firstLine, lastLine, caretLine, m)
    flushIme(m)
    if (scrollDirty) {
      scrollDirty = false
      onScrollListener?.invoke(frame)
    }
    if (selectionDirty) {
      selectionDirty = false
      onSelectionListener?.invoke(core.selection)
    }
    if (!drawn) {
      drawn = true
      onFirstDraw?.let { post(it) }
    }
  }

  /** Builds missing layouts for [first, last] with one highlight query over the lines that need it. */
  private fun prepare(first: Int, last: Int, m: RowMetrics) {
    val doc = core.document
    val consistent = snapshot?.takeIf { it.revision == doc.revision }
    val hl = highlighter
    val revision = if (consistent != null && hl != null) consistent.revision else -1
    var lo = -1
    var hi = -1
    if (revision >= 0) {
      for (line in first..last) {
        if (cache[line]?.revision == revision) continue
        if (lo < 0) lo = line
        hi = line
      }
    }
    val batch = if (lo >= 0 && consistent != null && hl != null) hl.spans(consistent, doc, lo, hi) else null
    for (line in first..last) {
      val entry = cache[line]
      val inBatch = batch != null && line >= lo && line <= hi
      val fresh = if (batch != null && inBatch) batch[line - lo].takeIf { it.isNotEmpty() } else null
      if (entry != null) {
        if (!inBatch) continue
        if (entry.spans.contentEquals(fresh)) {
          entry.revision = revision
          continue
        }
      }
      val layout = LineLayout(doc.line(line), fresh, paint, theme, viewport.wrapWidth, core.settings.tabSize, m)
      cache.put(line, Entry(layout, fresh, if (inBatch) revision else -1))
      viewport.measured(line, layout.rowCount)
      if (!viewport.wrap) viewport.widestLine = maxOf(viewport.widestLine, Math.round(layout.width()))
    }
  }

  private fun drawActiveLine(canvas: Canvas, caretLine: Int) {
    if (!highlightActiveLine || !core.selection.isEmpty) return
    val top = viewport.lineTop(caretLine)
    val bottom = top + heights.rows(caretLine) * viewport.rowHeight
    if (bottom <= 0 || top >= height) return
    fill.color = theme.activeLine
    canvas.drawRect(viewport.textAreaLeft.toFloat(), top.toFloat(), width.toFloat(), bottom.toFloat(), fill)
  }

  private fun drawSelection(canvas: Canvas, m: RowMetrics, firstLine: Int) {
    val sel = core.selection
    if (sel.isEmpty) return
    val doc = core.document
    val startLine = doc.lineAt(sel.min)
    val endLine = doc.lineAt(sel.max)
    if (endLine < firstLine) return
    fill.color = theme.selection
    val x0 = viewport.viewX(0f)
    canvas.save()
    canvas.clipRect(viewport.textAreaLeft, 0, width, height)
    for (line in maxOf(startLine, firstLine)..endLine) {
      val top = viewport.lineTop(line)
      if (top >= height) break
      val entry = cache[line] ?: break
      val ls = doc.lineStart(line)
      val from = if (line == startLine) sel.min - ls else 0
      val to = if (line == endLine) sel.max - ls else doc.lineLength(line)
      val lastRow = entry.layout.rowCount - 1
      entry.layout.selectionRows(from, to) { row, left, right ->
        val r = if (line != endLine && row == lastRow) right + m.spaceWidth else right
        val y = (top + row * m.rowHeight).toFloat()
        canvas.drawRect(x0 + left, y, x0 + r, y + m.rowHeight, fill)
      }
    }
    canvas.restore()
  }

  /** Returns the last line drawn. */
  private fun drawText(canvas: Canvas, firstLine: Int): Int {
    val doc = core.document
    var lastLine = firstLine
    canvas.save()
    canvas.clipRect(viewport.textAreaLeft, 0, width, height)
    var line = firstLine
    while (line < doc.lineCount) {
      val top = viewport.lineTop(line)
      if (top >= height) break
      val entry = cache[line] ?: break
      canvas.save()
      canvas.translate(viewport.viewX(0f), top.toFloat())
      entry.layout.draw(canvas)
      canvas.restore()
      lastLine = line
      line++
    }
    canvas.restore()
    return lastLine
  }

  /** One dp underline below the composing text, the same cue EditText gives while the keyboard composes. */
  private fun drawComposing(canvas: Canvas, m: RowMetrics, firstLine: Int) {
    val range = ime.composing ?: return
    val doc = core.document
    val startLine = doc.lineAt(range.start)
    val endLine = doc.lineAt(range.end)
    if (endLine < firstLine) return
    fill.color = theme.foreground
    val x0 = viewport.viewX(0f)
    val thickness = maxOf(1, dp(1f)).toFloat()
    canvas.save()
    canvas.clipRect(viewport.textAreaLeft, 0, width, height)
    for (line in maxOf(startLine, firstLine)..endLine) {
      val top = viewport.lineTop(line)
      if (top >= height) break
      val entry = cache[line] ?: break
      val ls = doc.lineStart(line)
      val from = if (line == startLine) range.start - ls else 0
      val to = if (line == endLine) range.end - ls else doc.lineLength(line)
      entry.layout.selectionRows(from, to) { row, left, right ->
        val bottom = (top + (row + 1) * m.rowHeight).toFloat()
        canvas.drawRect(x0 + left, bottom - thickness, x0 + right, bottom, fill)
      }
    }
    canvas.restore()
  }

  private fun drawGutter(canvas: Canvas, m: RowMetrics, firstLine: Int, lastLine: Int, caretLine: Int) {
    if (!lineNumbers) return
    val left = viewport.insetLeft.toFloat()
    val right = (viewport.insetLeft + viewport.gutterWidth).toFloat()
    fill.color = theme.gutterBackground
    canvas.drawRect(left, 0f, right, height.toFloat(), fill)
    val x = right - dp(GUTTER_PADDING_DP)
    for (line in firstLine..lastLine) {
      gutterPaint.color = if (line == caretLine) theme.gutterActiveForeground else theme.gutterForeground
      canvas.drawText((line + 1).toString(), x, (viewport.lineTop(line) - m.ascent).toFloat(), gutterPaint)
    }
  }

  private fun drawCaret(canvas: Canvas, m: RowMetrics, caretLine: Int) {
    if (!isFocused || !caretVisible || !core.selection.isEmpty) return
    val entry = cache[caretLine] ?: return
    val col = core.selection.head - core.document.lineStart(caretLine)
    val row = entry.layout.rowOf(col)
    val x = viewport.viewX(entry.layout.caretX(col))
    val top = (viewport.lineTop(caretLine) + row * m.rowHeight).toFloat()
    if (top + m.rowHeight <= 0f || top >= height || x < viewport.textAreaLeft) return
    fill.color = theme.cursor
    canvas.drawRect(x - 1f, top, x - 1f + dp(CARET_WIDTH_DP), top + m.rowHeight, fill)
  }

  private fun drawPlaceholder(canvas: Canvas, m: RowMetrics) {
    val text = placeholder ?: return
    if (core.document.length > 0) return
    paint.color = theme.gutterForeground
    canvas.drawText(text, viewport.viewX(0f), (viewport.lineTop(0) - m.ascent).toFloat(), paint)
    paint.color = theme.foreground
  }

  private fun publish(firstLine: Int, lastLine: Int, caretLine: Int, m: RowMetrics) {
    var caret: RectF? = null
    val entry = cache[caretLine]
    if (entry != null) {
      val col = core.selection.head - core.document.lineStart(caretLine)
      val row = entry.layout.rowOf(col)
      val x = viewport.viewX(entry.layout.caretX(col))
      val top = (viewport.lineTop(caretLine) + row * m.rowHeight).toFloat()
      caret = RectF(x / density, top / density, (x + dp(CARET_WIDTH_DP)) / density, (top + m.rowHeight) / density)
    }
    frame = FrameInfo(
      firstLine,
      lastLine,
      caret,
      viewport.scrollX / density,
      viewport.scrollY / density,
      viewport.contentWidth / density,
      viewport.contentHeight / density,
    )
  }

  companion object {
    private const val TEXT_PADDING_DP = 8f
    private const val GUTTER_PADDING_DP = 8f
    private const val CARET_WIDTH_DP = 2f
    private const val CARET_BLINK_MS = 500L
    private const val INSERTION_HANDLE_MS = 4000L
    private const val EDITOR_INFO_WINDOW = 2048
    private const val RECORD_TEXT_LIMIT = 1500
  }
}
