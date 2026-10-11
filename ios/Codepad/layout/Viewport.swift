import CoreGraphics
import Foundation

/// Scroll position and the mapping between rows and view points. Pure arithmetic over a HeightMap.
final class Viewport {
  struct Anchor {
    let line: Int
    let offset: Int
  }

  var heights: HeightMap
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

  private(set) var scrollX = 0
  private(set) var scrollY = 0

  init(heights: HeightMap) {
    self.heights = heights
  }

  var textAreaLeft: Int { insetLeft + gutterWidth }
  var textAreaWidth: Int { max(0, width - textAreaLeft - insetRight) }
  var viewportHeight: Int { max(0, height - insetTop - insetBottom) }

  /// Width handed to LineLayout. Zero means no wrapping.
  var wrapWidth: Int { wrap ? max(1, textAreaWidth - 2 * textPadding) : 0 }

  var contentWidth: Int { wrap ? textAreaWidth : max(textAreaWidth, widestLine + 2 * textPadding) }
  var contentHeight: Int { heights.totalRows * rowHeight }
  var maxScrollX: Int { max(0, contentWidth - textAreaWidth) }
  var maxScrollY: Int { max(0, contentHeight - viewportHeight) }

  /// Clamps and applies. Returns true when the position moved.
  @discardableResult
  func scrollTo(_ x: Int, _ y: Int) -> Bool {
    let nx = max(0, min(x, maxScrollX))
    let ny = max(0, min(y, maxScrollY))
    if nx == scrollX && ny == scrollY { return false }
    scrollX = nx
    scrollY = ny
    return true
  }

  @discardableResult
  func clamp() -> Bool {
    scrollTo(scrollX, scrollY)
  }

  /// Stores a view size. True when the text area width changed, which is when layouts must be rebuilt.
  func resize(width: Int, height: Int) -> Bool {
    let before = textAreaWidth
    self.width = width
    self.height = height
    return textAreaWidth != before
  }

  /// Stores the insets. True when the text area width changed.
  func setInsets(top: Int, bottom: Int, left: Int, right: Int) -> Bool {
    let before = textAreaWidth
    insetTop = top
    insetBottom = bottom
    insetLeft = left
    insetRight = right
    return textAreaWidth != before
  }

  /// View y of the top of `row`.
  func rowTop(_ row: Int) -> Int {
    insetTop + row * rowHeight - scrollY
  }

  func lineTop(_ line: Int) -> Int {
    rowTop(heights.rowStart(line))
  }

  /// Content row under view y, possibly outside [0, totalRows).
  func rowAt(_ y: Int) -> Int {
    Int((Double(y + scrollY - insetTop) / Double(rowHeight)).rounded(.down))
  }

  /// Layout x for a view x.
  func contentX(_ x: CGFloat) -> CGFloat {
    x - CGFloat(textAreaLeft + textPadding - scrollX)
  }

  /// View x for a layout x.
  func viewX(_ x: CGFloat) -> CGFloat {
    x + CGFloat(textAreaLeft + textPadding - scrollX)
  }

  func firstVisibleRow() -> Int {
    max(0, rowAt(insetTop))
  }

  func firstVisibleLine() -> Int {
    heights.lineAtRow(firstVisibleRow())
  }

  func lastVisibleLine() -> Int {
    heights.lineAtRow(max(firstVisibleRow(), rowAt(height - insetBottom - 1)))
  }

  /// Smallest scroll that shows a rect in layout coordinates (x from the text start, y from row 0) with the text padding around it.
  @discardableResult
  func reveal(left: Int, top: Int, right: Int, bottom: Int) -> Bool {
    var x = scrollX
    var y = scrollY
    let vh = viewportHeight
    let vw = textAreaWidth
    let l = left
    let r = right + 2 * textPadding
    if bottom - top >= vh || top < y { y = top } else if bottom > y + vh { y = bottom - vh }
    if r - l >= vw || l < x { x = l } else if r > x + vw { x = r - vw }
    return scrollTo(x, y)
  }

  /// Remembers the top visible line so a width or font change can put it back.
  func anchor() -> Anchor {
    let line = firstVisibleLine()
    return Anchor(line: line, offset: scrollY - heights.rowStart(line) * rowHeight)
  }

  func restore(_ anchor: Anchor) {
    let line = max(0, min(anchor.line, heights.lineCount - 1))
    let within = anchor.offset >= 0 && anchor.offset < heights.rows(line) * rowHeight ? anchor.offset : 0
    scrollTo(scrollX, heights.rowStart(line) * rowHeight + within)
  }

  /// Records a measurement. A line above the viewport shifts the scroll so the visible text stays put.
  func measured(_ line: Int, _ rows: Int) {
    let first = firstVisibleLine()
    let old = heights.setRows(line, rows)
    if old != rows && line < first { scrollY = max(0, min(scrollY + (rows - old) * rowHeight, maxScrollY)) }
  }
}
