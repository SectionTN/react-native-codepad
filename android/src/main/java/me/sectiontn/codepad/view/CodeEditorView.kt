package me.sectiontn.codepad.view

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.text.TextPaint
import android.util.TypedValue
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.View
import android.view.ViewConfiguration
import me.sectiontn.codepad.core.Change
import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.core.Range
import me.sectiontn.codepad.core.TextMovement
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
import kotlin.math.abs

/**
 * Draws the document through a viewport (height map, layout cache, gutter, active line, selection, caret)
 * and handles touch: scrolling with flings, taps, double taps and long press word selection.
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

  init {
    isFocusable = true
    isFocusableInTouchMode = true
    gutterPaint.textAlign = Paint.Align.RIGHT
    applyFont(Typeface.MONOSPACE, 14f)
    paint.color = theme.foreground
    scroller.setColor(theme.foreground)
    viewport.textPadding = dp(TEXT_PADDING_DP)
    wire(core)
  }

  fun setInitialText(value: String) {
    core = EditorCore(value)
    wire(core)
    engine().setText(value, core.document.revision)
    resetDocument()
  }

  fun setText(text: String, keepHistory: Boolean) {
    core.setText(text, keepHistory)
    viewport.scrollTo(0, 0)
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
    isReadOnly = enabled
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

  private fun applyFont(typeface: Typeface, sizeDp: Float) {
    val size = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, sizeDp, resources.displayMetrics)
    paint.typeface = typeface
    paint.textSize = size
    gutterPaint.typeface = typeface
    gutterPaint.textSize = size
    metrics = null
  }

  private fun wire(core: EditorCore) {
    core.onChange = { change, _ -> onDocumentChange(change) }
    core.onSelectionChange = { invalidate() }
  }

  private fun onDocumentChange(change: Change) {
    val doc = core.document
    val first = doc.lineAt(change.start)
    val oldCount = lineSpan(change.removed)
    val newCount = lineSpan(change.inserted)
    heights.replaceLines(first, oldCount, newCount)
    cache.shift(first, oldCount, newCount)
    engine().edit(change, SyntaxEngine.pointsFor(doc, change))
    if (updateGutter()) relayout() else viewport.clamp()
    invalidate()
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

  private inner class GestureHost : GestureMachine.Host {
    override fun offsetAt(x: Float, y: Float): Int = this@CodeEditorView.offsetAt(x, y)

    override fun handleAt(x: Float, y: Float): GestureMachine.Handle? = null

    override fun insideSelection(offset: Int): Boolean {
      val sel = core.selection
      return !sel.isEmpty && offset >= sel.min && offset <= sel.max
    }

    override fun canScroll(dx: Float, dy: Float): Boolean = isScrollEnabled && viewport.canScroll(dx, dy)

    override fun placeCaret(offset: Int) {
      requestFocus()
      core.setSelection(offset, offset)
    }

    override fun selectWord(offset: Int) {
      requestFocus()
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

    override fun moveHandle(handle: GestureMachine.Handle, x: Float, y: Float) {}

    override fun endHandleDrag() {}

    override fun beginScroll() {}

    override fun scrollBy(dx: Float, dy: Float) = scrollByTouch(dx, dy)

    override fun endScroll(velocityX: Float, velocityY: Float) {
      scroller.release()
      fling(velocityX, velocityY)
    }

    override fun showMenu() {}

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

  override fun onFocusChanged(gainFocus: Boolean, direction: Int, previouslyFocusedRect: Rect?) {
    super.onFocusChanged(gainFocus, direction, previouslyFocusedRect)
    invalidate()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    engine()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    removeCallbacks(longPressRunnable)
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
    val firstLine = viewport.firstVisibleLine()
    val lastBound = minOf(doc.lineCount - 1, firstLine + height / m.rowHeight + 1)
    prepare(firstLine, lastBound, m)
    val caretLine = doc.lineAt(core.selection.head)
    drawActiveLine(canvas, caretLine)
    drawSelection(canvas, m, firstLine)
    val lastLine = drawText(canvas, firstLine)
    drawGutter(canvas, m, firstLine, lastLine, caretLine)
    drawCaret(canvas, m, caretLine)
    drawPlaceholder(canvas, m)
    if (scroller.draw(canvas, width, height)) postInvalidateOnAnimation()
    publish(firstLine, lastLine, caretLine, m)
    if (scrollDirty) {
      scrollDirty = false
      onScrollListener?.invoke(frame)
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
    if (!isFocused || !core.selection.isEmpty) return
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
  }
}
