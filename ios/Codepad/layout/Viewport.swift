import CoreGraphics
import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// Scroll position, rows per line and the mapping between rows and view points, held by the core's layout.
/// Attached to the view's editor, so edits and gaps update the rows inside the core. Each member is one core call.
final class Viewport {
  struct Anchor {
    let line: Int
    let offset: Int
  }

  let handle: OpaquePointer
  private var config = cp_layout_config(
    row_height: 1, width: 0, height: 0, inset_top: 0, inset_bottom: 0, inset_left: 0, inset_right: 0,
    gutter_width: 0, text_padding: 0, wrap: 0)
  private weak var attached: EditorCore?

  init() {
    handle = cp_layout_new()!
  }

  deinit {
    if let core = attached { cp_editor_attach_layout(core.document.handle, nil) }
    cp_layout_free(handle)
  }

  /// Takes the editor's lines, one row each, and its gaps. The size, insets and metrics stay.
  func attach(_ core: EditorCore) {
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
    set { cp_layout_set_widest(handle, Int32(clamping: newValue)) }
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

  /// Clamps and applies. Returns true when the position moved.
  @discardableResult
  func scrollTo(_ x: Int, _ y: Int) -> Bool {
    cp_layout_scroll_to(handle, Int32(clamping: x), Int32(clamping: y), nil) != 0
  }

  @discardableResult
  func clamp() -> Bool {
    let g = geometry()
    return cp_layout_scroll_to(handle, g.scroll_x, g.scroll_y, nil) != 0
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

  func rowStart(_ line: Int) -> Int { Int(cp_layout_row_start(handle, Int32(clamping: line))) }
  func rows(_ line: Int) -> Int { Int(cp_layout_rows(handle, Int32(clamping: line))) }
  func gapRows(_ line: Int) -> Int { Int(cp_layout_gap_rows(handle, Int32(clamping: line))) }
  func lineAtRow(_ row: Int) -> Int { Int(cp_layout_line_at_row(handle, Int32(clamping: row))) }
  /// True when `row` is empty space under a line rather than one of its text rows.
  func isGapRow(_ row: Int) -> Bool { cp_layout_is_gap_row(handle, Int32(clamping: row)) != 0 }
  func rowTop(_ row: Int) -> Int { Int(cp_layout_row_top(handle, Int32(clamping: row))) }
  func lineTop(_ line: Int) -> Int { Int(cp_layout_line_top(handle, Int32(clamping: line))) }
  /// Content row under view y, possibly outside [0, totalRows).
  func rowAt(_ y: Int) -> Int { Int(cp_layout_row_at(handle, Int32(clamping: y))) }

  /// Layout x for a view x.
  func contentX(_ x: CGFloat) -> CGFloat { x - CGFloat(geometry().text_left) }

  /// View x for a layout x.
  func viewX(_ x: CGFloat) -> CGFloat { x + CGFloat(geometry().text_left) }

  func firstVisibleLine() -> Int { Int(geometry().first_line) }

  func lastVisibleLine() -> Int { Int(geometry().last_line) }

  /// Smallest scroll that shows a rect in layout coordinates (x from the text start, y from row 0) with the text padding around it.
  @discardableResult
  func reveal(left: Int, top: Int, right: Int, bottom: Int) -> Bool {
    cp_layout_reveal(
      handle, Int32(clamping: left), Int32(clamping: top), Int32(clamping: right), Int32(clamping: bottom), nil) != 0
  }

  /// Remembers the top visible line so a width or font change can put it back.
  func anchor() -> Anchor {
    var line: Int32 = 0
    var offset: Int32 = 0
    cp_layout_anchor(handle, &line, &offset)
    return Anchor(line: Int(line), offset: Int(offset))
  }

  func restore(_ anchor: Anchor) {
    cp_layout_restore(handle, Int32(clamping: anchor.line), Int32(clamping: anchor.offset))
  }

  /// Records a measurement. A line above the viewport shifts the scroll so the visible text stays put.
  func measured(_ line: Int, _ rows: Int) {
    var pair: [Int32] = [Int32(clamping: line), Int32(clamping: rows)]
    cp_layout_measure(handle, &pair, 1, -1, 0, -1, nil, nil, 0)
  }

  /// Every line back to one row. Gaps stay.
  func resetRows() {
    cp_layout_reset_rows(handle)
  }

  private func geometry() -> cp_geometry {
    var g = cp_geometry()
    cp_layout_geometry(handle, &g)
    return g
  }

  @discardableResult
  private func configure() -> Bool {
    var c = config
    return cp_layout_configure(handle, &c) != 0
  }
}
