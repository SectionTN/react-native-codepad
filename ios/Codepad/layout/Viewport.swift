import CoreGraphics
import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// Scroll position, rows per line and the mapping between rows and view points, held by the core's layout.
/// Attached to the view's editor, so edits and gaps update the rows inside the core. Outside a draw each member is
/// one core call. Inside one, the members read the copy the draw's scroll and measure calls returned.
final class Viewport {
  struct Anchor {
    let line: Int
    let offset: Int
  }

  /// A gap under a line: the view y where it starts and its height in rows.
  struct Gap: Equatable {
    let line: Int
    let top: Int
    let rows: Int
  }

  /// Core calls a draw may make besides its scroll and measure calls. Debug builds trap past it.
  static let drawCallLimit = 8

  let handle: OpaquePointer
  private var config = cp_layout_config(
    row_height: 1, width: 0, height: 0, inset_top: 0, inset_bottom: 0, inset_left: 0, inset_right: 0,
    gutter_width: 0, text_padding: 0, wrap: 0)
  private weak var attached: EditorCore?

  // The draw's copy. known holds the geometry while cached, buffer the measure call's output for first...last.
  private var drawing = false
  private var cached = false
  private var known = cp_geometry()
  private var first = 0
  private var last = -1
  private var buffer = [Int32](repeating: 0, count: 256)
  private var needed = 0
  /// Core calls this draw made besides its scroll and measure calls.
  private(set) var drawCalls = 0

  init() {
    handle = cp_layout_new()!
  }

  deinit {
    if let core = attached { cp_editor_attach_layout(core.document.handle, nil) }
    cp_layout_free(handle)
  }

  /// Takes the editor's lines, one row each, and its gaps. The size, insets and metrics stay.
  func attach(_ core: EditorCore) {
    changing()
    if let old = attached, old !== core { cp_editor_attach_layout(old.document.handle, nil) }
    attached = core
    cp_editor_attach_layout(core.document.handle, handle)
  }

  var rowHeight: Int {
    get { Int(config.row_height) }
    set {
      config.row_height = Int32(clamping: newValue)
      configure()
    }
  }
  var width: Int { Int(config.width) }
  var height: Int { Int(config.height) }
  var insetTop: Int { Int(config.inset_top) }
  var insetBottom: Int { Int(config.inset_bottom) }
  var insetLeft: Int { Int(config.inset_left) }
  var insetRight: Int { Int(config.inset_right) }
  var gutterWidth: Int {
    get { Int(config.gutter_width) }
    set {
      config.gutter_width = Int32(clamping: newValue)
      configure()
    }
  }
  var textPadding: Int {
    get { Int(config.text_padding) }
    set {
      config.text_padding = Int32(clamping: newValue)
      configure()
    }
  }
  var wrap: Bool {
    get { config.wrap != 0 }
    set {
      config.wrap = newValue ? 1 : 0
      configure()
    }
  }
  var widestLine: Int {
    get { Int(geometry().widest_line) }
    set {
      changing()
      cp_layout_set_widest(handle, Int32(clamping: newValue))
    }
  }

  var scrollX: Int { Int(geometry().scroll_x) }
  var scrollY: Int { Int(geometry().scroll_y) }
  var textAreaLeft: Int { Int(geometry().text_area_left) }
  var textAreaWidth: Int { Int(geometry().text_area_width) }
  var viewportHeight: Int { Int(geometry().viewport_height) }
  /// Width handed to LineLayout. Zero means no wrapping.
  var wrapWidth: Int { Int(geometry().wrap_width) }
  var contentWidth: Int { Int(geometry().content_width) }
  var contentHeight: Int { Int(geometry().content_height) }
  var maxScrollX: Int { Int(geometry().max_scroll_x) }
  var maxScrollY: Int { Int(geometry().max_scroll_y) }
  var totalRows: Int { Int(geometry().total_rows) }
  var lineCount: Int { Int(geometry().line_count) }

  /// With vertical scrolling off, a drag pans only when it is mostly horizontal and the text overflows.
  func pansSideways(dx: Double, dy: Double) -> Bool {
    maxScrollX > 0 && abs(dx) > abs(dy)
  }

  /// Starts a draw with the scroll view's offset, clamped. True when the position moved.
  @discardableResult
  func beginDraw(scrollX x: Int, scrollY y: Int) -> Bool {
    drawing = true
    drawCalls = 0
    last = first - 1
    let moved = cp_layout_scroll_to(handle, Int32(clamping: x), Int32(clamping: y), &known) != 0
    cached = true
    return moved
  }

  /// The draw's measure call: the rows laid out in this draw and the widest line, then the tops and rows of
  /// first...last and every gap. True when a measured line above the view moved the scroll.
  @discardableResult
  func measure(pairs: [Int32], widest: Int, first: Int, last: Int) -> Bool {
    let before = scrollY
    self.first = first
    self.last = last
    fill(pairs, widest: widest)
    return known.scroll_y != Int32(clamping: before)
  }

  func endDraw() {
    drawing = false
    cached = false
    last = first - 1
  }

  /// Clamps and applies. Returns true when the position moved.
  @discardableResult
  func scrollTo(_ x: Int, _ y: Int) -> Bool {
    crossed()
    var g = cp_geometry()
    let moved = cp_layout_scroll_to(handle, Int32(clamping: x), Int32(clamping: y), &g) != 0
    moving(g, moved)
    return moved
  }

  @discardableResult
  func clamp() -> Bool {
    let g = geometry()
    return scrollTo(Int(g.scroll_x), Int(g.scroll_y))
  }

  /// Stores a view size. True when the text area width changed, which is when layouts must be rebuilt.
  @discardableResult
  func resize(width: Int, height: Int) -> Bool {
    config.width = Int32(clamping: width)
    config.height = Int32(clamping: height)
    return configure()
  }

  /// Stores the insets. True when the text area width changed.
  @discardableResult
  func setInsets(top: Int, bottom: Int, left: Int, right: Int) -> Bool {
    config.inset_top = Int32(clamping: top)
    config.inset_bottom = Int32(clamping: bottom)
    config.inset_left = Int32(clamping: left)
    config.inset_right = Int32(clamping: right)
    return configure()
  }

  func rowStart(_ line: Int) -> Int {
    if let top = drawnTop(line) { return (top - insetTop + Int(known.scroll_y)) / rowHeight }
    crossed()
    return Int(cp_layout_row_start(handle, Int32(clamping: line)))
  }

  func rows(_ line: Int) -> Int {
    if cached, line >= first, line <= last { return Int(buffer[last - first + 2 + line - first]) }
    crossed()
    return Int(cp_layout_rows(handle, Int32(clamping: line)))
  }

  func gapRows(_ line: Int) -> Int {
    crossed()
    return Int(cp_layout_gap_rows(handle, Int32(clamping: line)))
  }

  func lineAtRow(_ row: Int) -> Int {
    crossed()
    return Int(cp_layout_line_at_row(handle, Int32(clamping: row)))
  }

  /// True when `row` is empty space under a line rather than one of its text rows.
  func isGapRow(_ row: Int) -> Bool {
    crossed()
    return cp_layout_is_gap_row(handle, Int32(clamping: row)) != 0
  }

  func rowTop(_ row: Int) -> Int {
    if cached { return insetTop + row * rowHeight - Int(known.scroll_y) }
    crossed()
    return Int(cp_layout_row_top(handle, Int32(clamping: row)))
  }

  func lineTop(_ line: Int) -> Int {
    if let top = drawnTop(line) { return top }
    crossed()
    return Int(cp_layout_line_top(handle, Int32(clamping: line)))
  }

  /// Content row under view y, possibly outside [0, totalRows).
  func rowAt(_ y: Int) -> Int {
    crossed()
    return Int(cp_layout_row_at(handle, Int32(clamping: y)))
  }

  /// Every gap in line order.
  func gaps() -> [Gap] {
    if !cached || last < first {
      crossed()
      var none: [Int32] = []
      let count = Int(cp_layout_measure(handle, &none, 0, -1, 0, 0, nil, nil, 0))
      var out = [Int32](repeating: 0, count: count)
      cp_layout_measure(handle, &none, 0, -1, 0, 0, nil, &out, UInt32(count))
      return Viewport.parseGaps(out, from: 3)
    }
    return Viewport.parseGaps(buffer[0..<needed], from: 2 * (last - first + 1) + 1)
  }

  /// Layout x for a view x.
  func contentX(_ x: CGFloat) -> CGFloat { x - CGFloat(geometry().text_left) }

  /// View x for a layout x.
  func viewX(_ x: CGFloat) -> CGFloat { x + CGFloat(geometry().text_left) }

  func firstVisibleLine() -> Int { Int(geometry().first_line) }

  func lastVisibleLine() -> Int { Int(geometry().last_line) }

  /// Smallest scroll that shows a rect in layout coordinates (x from the text start, y from row 0) with the text padding around it.
  @discardableResult
  func reveal(left: Int, top: Int, right: Int, bottom: Int) -> Bool {
    crossed()
    var g = cp_geometry()
    let moved =
      cp_layout_reveal(
        handle, Int32(clamping: left), Int32(clamping: top), Int32(clamping: right), Int32(clamping: bottom), &g) != 0
    moving(g, moved)
    return moved
  }

  /// Remembers the top visible line so a width or font change can put it back.
  func anchor() -> Anchor {
    crossed()
    var line: Int32 = 0
    var offset: Int32 = 0
    cp_layout_anchor(handle, &line, &offset)
    return Anchor(line: Int(line), offset: Int(offset))
  }

  func restore(_ anchor: Anchor) {
    changing()
    cp_layout_restore(handle, Int32(clamping: anchor.line), Int32(clamping: anchor.offset))
  }

  /// Records a measurement and raises the widest line to `widest` when not wrapping. A line above the viewport
  /// shifts the scroll so the visible text stays put.
  func measured(_ line: Int, _ rows: Int, widest: Int = -1) {
    crossed()
    let pair: [Int32] = [Int32(clamping: line), Int32(clamping: rows)]
    if drawing {
      fill(pair, widest: widest)
    } else {
      var p = pair
      cp_layout_measure(handle, &p, 1, Int32(clamping: widest), 0, -1, nil, nil, 0)
    }
  }

  /// Every line back to one row. Gaps stay.
  func resetRows() {
    changing()
    cp_layout_reset_rows(handle)
  }

  /// One measure call that refreshes the draw's copy, grown and repeated when the buffer is short. Applying the
  /// same rows and widest line again changes nothing.
  private func fill(_ pairs: [Int32], widest: Int) {
    var p = pairs
    let pairCount = UInt32(pairs.count / 2)
    let wide = Int32(clamping: widest)
    let lo = Int32(clamping: first)
    let hi = Int32(clamping: last)
    var n = Int(cp_layout_measure(handle, &p, pairCount, wide, lo, hi, &known, &buffer, UInt32(buffer.count)))
    if n > buffer.count {
      crossed()
      buffer = [Int32](repeating: 0, count: n)
      n = Int(cp_layout_measure(handle, &p, pairCount, wide, lo, hi, &known, &buffer, UInt32(buffer.count)))
    }
    needed = n
    cached = true
  }

  private func drawnTop(_ line: Int) -> Int? {
    cached && last >= first && line >= first && line <= last + 1 ? Int(buffer[line - first]) : nil
  }

  private static func parseGaps(_ ints: ArraySlice<Int32>, from start: Int) -> [Gap] {
    var out: [Gap] = []
    var i = ints.startIndex + start
    while i + 2 < ints.endIndex {
      out.append(Gap(line: Int(ints[i]), top: Int(ints[i + 1]), rows: Int(ints[i + 2])))
      i += 3
    }
    return out
  }

  private static func parseGaps(_ ints: [Int32], from start: Int) -> [Gap] { parseGaps(ints[...], from: start) }

  private func geometry() -> cp_geometry {
    if cached { return known }
    crossed()
    var g = cp_geometry()
    cp_layout_geometry(handle, &g)
    return g
  }

  /// A scroll inside a draw refreshes the geometry. Tops taken before a move are stale.
  private func moving(_ g: cp_geometry, _ moved: Bool) {
    guard drawing else { return }
    known = g
    cached = true
    if moved { last = first - 1 }
  }

  /// A size, metric or row change has no place inside a draw: the copy would go stale.
  private func changing() {
    guard drawing else { return }
    assertionFailure("layout changed inside a draw")
    cached = false
    last = first - 1
  }

  private func crossed() {
    guard drawing else { return }
    drawCalls += 1
    #if DEBUG
      if drawCalls > Viewport.drawCallLimit { assertionFailure("\(drawCalls) layout calls in one draw") }
    #endif
  }

  @discardableResult
  private func configure() -> Bool {
    changing()
    var c = config
    return cp_layout_configure(handle, &c) != 0
  }
}
