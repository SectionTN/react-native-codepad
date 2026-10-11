package me.sectiontn.codepad.layout

/** Scroll position and the mapping between rows and view pixels. Pure arithmetic over a HeightMap. */
class Viewport(var heights: HeightMap) {
  class Anchor(val line: Int, val offset: Int)

  var rowHeight = 1
  var width = 0
  var height = 0
  var insetTop = 0
  var insetBottom = 0
  var insetLeft = 0
  var insetRight = 0
  var gutterWidth = 0
  var textPadding = 0
  var wrap = false
  var widestLine = 0

  var scrollX = 0
    private set
  var scrollY = 0
    private set

  val textAreaLeft: Int get() = insetLeft + gutterWidth
  val textAreaWidth: Int get() = maxOf(0, width - textAreaLeft - insetRight)
  val viewportHeight: Int get() = maxOf(0, height - insetTop - insetBottom)

  /** Width handed to LineLayout. Zero means no wrapping. */
  val wrapWidth: Int get() = if (wrap) maxOf(1, textAreaWidth - 2 * textPadding) else 0

  val contentWidth: Int get() = if (wrap) textAreaWidth else maxOf(textAreaWidth, widestLine + 2 * textPadding)
  val contentHeight: Int get() = heights.totalRows * rowHeight
  val maxScrollX: Int get() = maxOf(0, contentWidth - textAreaWidth)
  val maxScrollY: Int get() = maxOf(0, contentHeight - viewportHeight)

  /** Clamps and applies. Returns true when the position moved. */
  fun scrollTo(x: Int, y: Int): Boolean {
    val nx = x.coerceIn(0, maxScrollX)
    val ny = y.coerceIn(0, maxScrollY)
    if (nx == scrollX && ny == scrollY) return false
    scrollX = nx
    scrollY = ny
    return true
  }

  fun scrollBy(dx: Int, dy: Int): Boolean = scrollTo(scrollX + dx, scrollY + dy)

  fun clamp(): Boolean = scrollTo(scrollX, scrollY)

  /** Stores a view size. True when the text area width changed, which is when layouts must be rebuilt. */
  fun resize(width: Int, height: Int): Boolean {
    val before = textAreaWidth
    this.width = width
    this.height = height
    return textAreaWidth != before
  }

  /** Stores the insets. True when the text area width changed. */
  fun setInsets(top: Int, bottom: Int, left: Int, right: Int): Boolean {
    val before = textAreaWidth
    insetTop = top
    insetBottom = bottom
    insetLeft = left
    insetRight = right
    return textAreaWidth != before
  }

  /** Content deltas: positive dy means the content moves up, so the finger moved up. */
  fun canScroll(dx: Float, dy: Float): Boolean =
    (dx < 0 && scrollX > 0) || (dx > 0 && scrollX < maxScrollX) ||
      (dy < 0 && scrollY > 0) || (dy > 0 && scrollY < maxScrollY)

  /** View y of the top of [row]. */
  fun rowTop(row: Int): Int = insetTop + row * rowHeight - scrollY

  fun lineTop(line: Int): Int = rowTop(heights.rowStart(line))

  /** Content row under view y, possibly outside [0, totalRows). */
  fun rowAt(y: Int): Int = Math.floorDiv(y + scrollY - insetTop, rowHeight)

  /** Layout x for a view x. */
  fun contentX(x: Float): Float = x - textAreaLeft - textPadding + scrollX

  /** View x for a layout x. */
  fun viewX(x: Float): Float = x + textAreaLeft + textPadding - scrollX

  fun firstVisibleRow(): Int = maxOf(0, rowAt(insetTop))

  fun firstVisibleLine(): Int = heights.lineAtRow(firstVisibleRow())

  fun lastVisibleLine(): Int = heights.lineAtRow(maxOf(firstVisibleRow(), rowAt(height - insetBottom - 1)))

  /** Smallest scroll that shows a rect in layout coordinates (x from the text start, y from row 0) with the text padding around it. */
  fun reveal(left: Int, top: Int, right: Int, bottom: Int): Boolean {
    var x = scrollX
    var y = scrollY
    val vh = viewportHeight
    val vw = textAreaWidth
    val l = left
    val r = right + 2 * textPadding
    if (bottom - top >= vh || top < y) y = top else if (bottom > y + vh) y = bottom - vh
    if (r - l >= vw || l < x) x = l else if (r > x + vw) x = r - vw
    return scrollTo(x, y)
  }

  /** Remembers the top visible line so a width or font change can put it back. */
  fun anchor(): Anchor {
    val line = firstVisibleLine()
    return Anchor(line, scrollY - heights.rowStart(line) * rowHeight)
  }

  fun restore(anchor: Anchor) {
    val line = anchor.line.coerceIn(0, heights.lineCount - 1)
    val within = if (anchor.offset in 0 until heights.rows(line) * rowHeight) anchor.offset else 0
    scrollTo(scrollX, heights.rowStart(line) * rowHeight + within)
  }

  /** Records a measurement. A line above the viewport shifts the scroll so the visible text stays put. */
  fun measured(line: Int, rows: Int) {
    val first = firstVisibleLine()
    val old = heights.setRows(line, rows)
    if (old != rows && line < first) scrollY = (scrollY + (rows - old) * rowHeight).coerceIn(0, maxScrollY)
  }
}
