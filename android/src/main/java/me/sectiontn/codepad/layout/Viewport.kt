package me.sectiontn.codepad.layout

import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.syntax.CoreNative

/**
 * Scroll position, rows per line and the mapping between rows and view pixels, held by the core's layout. Attached to
 * the view's editor, so edits and gaps update the rows inside the core. Outside a draw each member is one core call.
 * Inside one, the members read the copy the draw's measure call returned. Main thread only.
 */
class Viewport {
  class Anchor(val line: Int, val offset: Int)

  /** A gap under a line: the view y where it starts and its height in rows. */
  data class Gap(val line: Int, val top: Int, val rows: Int)

  /** The result of the last [scrollTo], [scrollBy] or [scroll], read without another call. */
  class Scroll {
    var x = 0
    var y = 0
    var maxX = 0
    var maxY = 0
    /** Bit 1: x moved, bit 2: y moved. */
    var axes = 0
    var dx = 0
    var dy = 0
  }

  private var handle: Long = CoreNative.layoutNew()
  // cp_layout_config: row height, width, height, insets top, bottom, left, right, gutter, text padding, wrap.
  private val config = IntArray(10).also { it[ROW_HEIGHT] = 1 }
  private var attached: EditorCore? = null

  // The last geometry the core returned. Its config-only fields hold until the next configure, the rest only inside
  // the draw that cached it.
  private val known = IntArray(GEOMETRY)
  private var configKnown = false
  private var drawing = false
  private var cached = false
  private var first = 0
  private var last = -1
  private var buffer = IntArray(256)
  private var needed = 0
  private var checksCalls = false
  private val anchorOut = IntArray(2)
  private val measuredPair = IntArray(2)

  /** Core calls this draw made besides its frame and measure calls. */
  var drawCalls = 0
    private set

  val lastScroll = Scroll()

  private fun handle(): Long {
    val h = handle
    check(h != 0L) { "the layout is closed" }
    return h
  }

  /** For the frame call, which takes the layout. */
  internal fun nativeHandle(): Long = handle()

  /** Frees the layout. An editor it is still attached to keeps its rows until that editor goes. */
  fun close() {
    val h = handle
    if (h == 0L) return
    handle = 0L
    attached = null
    CoreNative.layoutFree(h)
  }

  /** Takes the editor's lines, one row each, and its gaps. The size, insets and metrics stay. */
  fun attach(core: EditorCore) {
    changing()
    val old = attached
    if (old != null && old !== core && old.isOpen) CoreNative.editorAttachLayout(old.handle(), 0L)
    attached = core
    CoreNative.editorAttachLayout(core.handle(), handle())
  }

  var rowHeight: Int
    get() = config[ROW_HEIGHT]
    set(value) {
      config[ROW_HEIGHT] = value
      configure()
    }
  val width: Int get() = config[WIDTH]
  val height: Int get() = config[HEIGHT]
  val insetTop: Int get() = config[INSET_TOP]
  val insetBottom: Int get() = config[INSET_BOTTOM]
  val insetLeft: Int get() = config[INSET_LEFT]
  val insetRight: Int get() = config[INSET_RIGHT]
  var gutterWidth: Int
    get() = config[GUTTER]
    set(value) {
      config[GUTTER] = value
      configure()
    }
  var textPadding: Int
    get() = config[PADDING]
    set(value) {
      config[PADDING] = value
      configure()
    }
  var wrap: Boolean
    get() = config[WRAP] != 0
    set(value) {
      config[WRAP] = if (value) 1 else 0
      configure()
    }
  var widestLine: Int
    get() = field(WIDEST)
    set(value) {
      changing()
      CoreNative.layoutSetWidest(handle(), value)
    }

  val scrollX: Int get() = field(SCROLL_X)
  val scrollY: Int get() = field(SCROLL_Y)
  val maxScrollX: Int get() = field(MAX_X)
  val maxScrollY: Int get() = field(MAX_Y)
  val contentWidth: Int get() = field(CONTENT_WIDTH)
  val contentHeight: Int get() = field(CONTENT_HEIGHT)
  val totalRows: Int get() = field(TOTAL_ROWS)
  val lineCount: Int get() = field(LINE_COUNT)
  val textAreaLeft: Int get() = configField(TEXT_AREA_LEFT)
  val textAreaWidth: Int get() = configField(TEXT_AREA_WIDTH)
  val viewportHeight: Int get() = configField(VIEWPORT_HEIGHT)
  /** Width handed to LineLayout. Zero means no wrapping. */
  val wrapWidth: Int get() = configField(WRAP_WIDTH)

  /** Starts a draw. With [checksCalls], a ninth single layout call before [endDraw] throws. */
  fun beginDraw(checksCalls: Boolean) {
    drawing = true
    this.checksCalls = checksCalls
    drawCalls = 0
    cached = false
    last = first - 1
  }

  /**
   * The draw's measure call: the first [pairCount] (line, rows) pairs and the widest line, then the tops and rows of
   * [first]..[last] and every gap. Returns true when it moved the scroll from the last position this viewport read.
   */
  fun measure(pairs: IntArray, pairCount: Int, widest: Int, first: Int, last: Int): Boolean {
    val before = known[SCROLL_Y]
    this.first = first
    this.last = last
    fill(pairs, pairCount, widest)
    return known[SCROLL_Y] != before
  }

  fun endDraw() {
    drawing = false
    cached = false
    last = first - 1
  }

  /** Clamps and applies, with the result in [lastScroll]. Returns true when the position moved. */
  fun scrollTo(x: Int, y: Int): Boolean {
    crossed()
    val axes = CoreNative.layoutScrollTo(handle(), x, y, known)
    took(axes != 0)
    record(axes)
    return axes != 0
  }

  /** Moves by a content delta, with the applied delta in [lastScroll]. */
  fun scrollBy(dx: Int, dy: Int): Boolean {
    val s = scroll()
    val x = s.x
    val y = s.y
    val moved = scrollTo(x + dx, y + dy)
    lastScroll.dx = lastScroll.x - x
    lastScroll.dy = lastScroll.y - y
    return moved
  }

  /** The scroll and its bounds in one read, into [lastScroll]. */
  fun scroll(): Scroll {
    geometry()
    record(0)
    return lastScroll
  }

  fun clamp(): Boolean {
    val s = scroll()
    return scrollTo(s.x, s.y)
  }

  /** Stores a view size. True when the text area width changed, which is when layouts must be rebuilt. */
  fun resize(width: Int, height: Int): Boolean {
    config[WIDTH] = width
    config[HEIGHT] = height
    return configure()
  }

  /** Stores the insets. True when the text area width changed. */
  fun setInsets(top: Int, bottom: Int, left: Int, right: Int): Boolean {
    config[INSET_TOP] = top
    config[INSET_BOTTOM] = bottom
    config[INSET_LEFT] = left
    config[INSET_RIGHT] = right
    return configure()
  }

  /** Content deltas: positive dy means the content moves up, so the finger moved up. */
  fun canScroll(dx: Float, dy: Float): Boolean {
    val s = scroll()
    return (dx < 0 && s.x > 0) || (dx > 0 && s.x < s.maxX) || (dy < 0 && s.y > 0) || (dy > 0 && s.y < s.maxY)
  }

  fun rowStart(line: Int): Int {
    drawnTop(line)?.let { return (it - insetTop + known[SCROLL_Y]) / rowHeight }
    crossed()
    return CoreNative.layoutRowStart(handle(), line)
  }

  fun rows(line: Int): Int {
    if (cached && line in first..last) return buffer[last - first + 2 + line - first]
    crossed()
    return CoreNative.layoutRows(handle(), line)
  }

  fun gapRows(line: Int): Int {
    crossed()
    return CoreNative.layoutGapRows(handle(), line)
  }

  fun lineAtRow(row: Int): Int {
    crossed()
    return CoreNative.layoutLineAtRow(handle(), row)
  }

  /** True when [row] is empty space under a line rather than one of its text rows. */
  fun isGapRow(row: Int): Boolean {
    crossed()
    return CoreNative.layoutIsGapRow(handle(), row)
  }

  /** View y of the top of [row]. */
  fun rowTop(row: Int): Int {
    if (cached) return insetTop + row * rowHeight - known[SCROLL_Y]
    crossed()
    return CoreNative.layoutRowTop(handle(), row)
  }

  fun lineTop(line: Int): Int {
    drawnTop(line)?.let { return it }
    crossed()
    return CoreNative.layoutLineTop(handle(), line)
  }

  /** Content row under view y, possibly outside [0, totalRows). */
  fun rowAt(y: Int): Int {
    crossed()
    return CoreNative.layoutRowAt(handle(), y)
  }

  /** Every gap in line order. */
  fun gaps(): List<Gap> {
    if (cached && last >= first) return parseGaps(buffer, needed, 2 * (last - first + 1) + 1)
    crossed()
    val count = CoreNative.layoutMeasure(handle(), IntArray(0), 0, -1, 0, 0, known, IntArray(0))
    val out = IntArray(count)
    CoreNative.layoutMeasure(handle(), IntArray(0), 0, -1, 0, 0, known, out)
    configKnown = true
    return parseGaps(out, count, 3)
  }

  /** Layout x for a view x. */
  fun contentX(x: Float): Float = x - field(TEXT_LEFT)

  /** View x for a layout x. */
  fun viewX(x: Float): Float = x + field(TEXT_LEFT)

  fun firstVisibleLine(): Int = field(FIRST_LINE)

  fun lastVisibleLine(): Int = field(LAST_LINE)

  /** Smallest scroll that shows a rect in layout coordinates (x from the text start, y from row 0) with the text padding. */
  fun reveal(left: Int, top: Int, right: Int, bottom: Int): Boolean {
    crossed()
    val moved = CoreNative.layoutReveal(handle(), left, top, right, bottom, known)
    took(moved)
    return moved
  }

  /** Remembers the top visible line so a width or font change can put it back. */
  fun anchor(): Anchor {
    crossed()
    CoreNative.layoutAnchor(handle(), anchorOut)
    return Anchor(anchorOut[0], anchorOut[1])
  }

  fun restore(anchor: Anchor) {
    changing()
    CoreNative.layoutRestore(handle(), anchor.line, anchor.offset)
  }

  /**
   * Records a measurement and raises the widest line to [widest] when not wrapping. A line above the viewport shifts
   * the scroll so the visible text stays put.
   */
  fun measured(line: Int, rows: Int, widest: Int = -1) {
    crossed()
    measuredPair[0] = line
    measuredPair[1] = rows
    if (drawing) {
      fill(measuredPair, 1, widest)
    } else {
      CoreNative.layoutMeasure(handle(), measuredPair, 1, widest, 0, -1, known, buffer)
      configKnown = true
    }
  }

  /** Every line back to one row. Gaps stay. */
  fun resetRows() {
    changing()
    CoreNative.layoutResetRows(handle())
  }

  // One measure call that refreshes the draw's copy, grown and repeated when the buffer is short. Applying the same
  // rows and widest line again changes nothing.
  private fun fill(pairs: IntArray, pairCount: Int, widest: Int) {
    var n = CoreNative.layoutMeasure(handle(), pairs, pairCount, widest, first, last, known, buffer)
    if (n > buffer.size) {
      crossed()
      buffer = IntArray(n)
      n = CoreNative.layoutMeasure(handle(), pairs, pairCount, widest, first, last, known, buffer)
    }
    needed = n
    cached = drawing
    configKnown = true
  }

  // last < first means this draw has no tops yet, or lost them to a scroll move.
  private fun drawnTop(line: Int): Int? =
    if (cached && last >= first && line >= first && line <= last + 1) buffer[line - first] else null

  private fun field(i: Int): Int {
    if (!cached) geometry()
    return known[i]
  }

  // Text area, viewport height and wrap width follow the config alone, so any geometry since the last configure holds.
  private fun configField(i: Int): Int {
    if (!configKnown && !cached) geometry()
    return known[i]
  }

  private fun geometry() {
    if (cached) return
    crossed()
    CoreNative.layoutGeometry(handle(), known)
    configKnown = true
  }

  private fun record(axes: Int) {
    lastScroll.x = known[SCROLL_X]
    lastScroll.y = known[SCROLL_Y]
    lastScroll.maxX = known[MAX_X]
    lastScroll.maxY = known[MAX_Y]
    lastScroll.axes = axes
    lastScroll.dx = 0
    lastScroll.dy = 0
  }

  // A scroll call wrote the geometry into known. Inside a draw the copy stays, but tops taken before a move are stale.
  private fun took(moved: Boolean) {
    configKnown = true
    if (!drawing) return
    cached = true
    if (moved) last = first - 1
  }

  // A size, metric or row change has no place inside a draw: the copy would go stale.
  private fun changing() {
    if (!drawing) return
    check(!checksCalls) { "layout changed inside a draw" }
    cached = false
    configKnown = false
    last = first - 1
  }

  private fun crossed() {
    if (!drawing) return
    drawCalls++
    check(!checksCalls || drawCalls <= DRAW_CALL_LIMIT) { "$drawCalls layout calls in one draw" }
  }

  private fun configure(): Boolean {
    changing()
    configKnown = false
    return CoreNative.layoutConfigure(handle(), config)
  }

  companion object {
    /** Single layout calls a draw may make besides its frame and measure calls. */
    const val DRAW_CALL_LIMIT = 8

    private const val ROW_HEIGHT = 0
    private const val WIDTH = 1
    private const val HEIGHT = 2
    private const val INSET_TOP = 3
    private const val INSET_BOTTOM = 4
    private const val INSET_LEFT = 5
    private const val INSET_RIGHT = 6
    private const val GUTTER = 7
    private const val PADDING = 8
    private const val WRAP = 9

    // cp_geometry, in its field order.
    private const val SCROLL_X = 0
    private const val SCROLL_Y = 1
    private const val MAX_X = 2
    private const val MAX_Y = 3
    private const val CONTENT_WIDTH = 4
    private const val CONTENT_HEIGHT = 5
    private const val FIRST_LINE = 6
    private const val LAST_LINE = 7
    private const val TEXT_AREA_LEFT = 8
    private const val TEXT_AREA_WIDTH = 9
    private const val VIEWPORT_HEIGHT = 10
    private const val WRAP_WIDTH = 11
    private const val TEXT_LEFT = 12
    private const val TOTAL_ROWS = 13
    private const val LINE_COUNT = 14
    private const val WIDEST = 16
    private const val GEOMETRY = 17

    private fun parseGaps(ints: IntArray, size: Int, start: Int): List<Gap> {
      val out = ArrayList<Gap>()
      var i = start
      while (i + 2 < size) {
        out.add(Gap(ints[i], ints[i + 1], ints[i + 2]))
        i += 3
      }
      return out
    }
  }
}
