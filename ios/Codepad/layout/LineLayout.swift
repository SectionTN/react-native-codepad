import CoreGraphics
import CoreText
import Foundation

/// One line laid out by Core Text: a single CTLine, or one per visual row under soft wrap. Rows sit on the
/// uniform row grid whatever the fallback fonts say.
final class LineLayout {
  let length: Int
  private let lines: [CTLine]
  private let rowStarts: [Int]
  private let metrics: RowMetrics

  init(
    text: [UInt16], spans: [Int], font: CTFont, styles: StyleResolver, foreground: CGColor, metrics: RowMetrics,
    wrapWidth: Int
  ) {
    length = text.count
    self.metrics = metrics
    let attributed = NSMutableAttributedString(string: String(decoding: text, as: UTF16.self))
    let whole = NSRange(location: 0, length: attributed.length)
    attributed.setAttributes(
      [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): foreground,
        NSAttributedString.Key(kCTParagraphStyleAttributeName as String): LineLayout.paragraphStyle(tabWidth: metrics.tabWidth),
      ], range: whole)
    var i = 0
    while i + 2 < spans.count {
      let start = max(0, min(spans[i], attributed.length))
      let end = max(start, min(spans[i + 1], attributed.length))
      if end > start, let style = styles.style(spans[i + 2]) {
        let range = NSRange(location: start, length: end - start)
        attributed.addAttribute(NSAttributedString.Key(kCTForegroundColorAttributeName as String), value: style.color, range: range)
        if style.bold || style.italic {
          attributed.addAttribute(
            NSAttributedString.Key(kCTFontAttributeName as String), value: metrics.font(bold: style.bold, italic: style.italic),
            range: range)
        }
      }
      i += 3
    }
    if wrapWidth > 0 && attributed.length > 0 {
      let typesetter = CTTypesetterCreateWithAttributedString(attributed)
      var start = 0
      var starts: [Int] = []
      var rows: [CTLine] = []
      while start < attributed.length {
        var count = CTTypesetterSuggestLineBreak(typesetter, start, Double(wrapWidth))
        if count <= 0 { count = 1 }
        starts.append(start)
        rows.append(CTTypesetterCreateLine(typesetter, CFRange(location: start, length: count)))
        start += count
      }
      lines = rows
      rowStarts = starts
    } else {
      lines = [CTLineCreateWithAttributedString(attributed)]
      rowStarts = [0]
    }
  }

  var rowCount: Int { lines.count }

  func width() -> CGFloat {
    lines.map { CGFloat(CTLineGetTypographicBounds($0, nil, nil, nil)) }.max() ?? 0
  }

  func rowOf(_ column: Int) -> Int {
    let c = max(0, min(column, length))
    var row = 0
    while row + 1 < rowStarts.count && rowStarts[row + 1] <= c { row += 1 }
    return row
  }

  /// The string indexes [start, end) a row covers.
  func rowRange(_ row: Int) -> (Int, Int) {
    (rowStarts[row], row + 1 < rowStarts.count ? rowStarts[row + 1] : length)
  }

  func caretX(_ column: Int) -> CGFloat {
    let c = max(0, min(column, length))
    return CTLineGetOffsetForStringIndex(lines[rowOf(c)], c, nil)
  }

  func columnAt(row: Int, x: CGFloat) -> Int {
    let r = max(0, min(row, rowCount - 1))
    let (start, end) = rowRange(r)
    let index = CTLineGetStringIndexForPosition(lines[r], CGPoint(x: x, y: 0))
    if index == kCFNotFound { return x < 0 ? start : end }
    return max(start, min(index, end))
  }

  /// Calls `out` once per row that [from, to) touches, with the row's horizontal extent.
  func selectionRows(from: Int, to: Int, _ out: (_ row: Int, _ left: CGFloat, _ right: CGFloat) -> Void) {
    let a = max(0, min(from, length))
    let b = max(a, min(to, length))
    let firstRow = rowOf(a)
    let lastRow = rowOf(b)
    for row in firstRow...lastRow {
      let left = row == firstRow ? caretX(a) : 0
      let right = row == lastRow ? caretX(b) : CGFloat(CTLineGetTypographicBounds(lines[row], nil, nil, nil))
      out(row, min(left, right), max(left, right))
    }
  }

  /// Draws every row into a y-down context, baselines at top + row * rowHeight + ascent.
  func draw(in ctx: CGContext, top: CGFloat) {
    for (row, line) in lines.enumerated() {
      let baseline = top + CGFloat(row * metrics.rowHeight) + metrics.ascent
      ctx.saveGState()
      ctx.textMatrix = .identity
      ctx.translateBy(x: 0, y: baseline)
      ctx.scaleBy(x: 1, y: -1)
      ctx.textPosition = .zero
      CTLineDraw(line, ctx)
      ctx.restoreGState()
    }
  }

  /// Tabs at multiples of the tab width: an empty stop list makes Core Text use the default interval alone.
  private static func paragraphStyle(tabWidth: Int) -> CTParagraphStyle {
    var interval = Double(tabWidth)
    var stops = [Any]() as CFArray
    return withUnsafePointer(to: &interval) { intervalPointer in
      withUnsafePointer(to: &stops) { stopsPointer in
        let settings = [
          CTParagraphStyleSetting(
            spec: .defaultTabInterval, valueSize: MemoryLayout<Double>.size, value: UnsafeRawPointer(intervalPointer)),
          CTParagraphStyleSetting(spec: .tabStops, valueSize: MemoryLayout<CFArray>.size, value: UnsafeRawPointer(stopsPointer)),
        ]
        return CTParagraphStyleCreate(settings, settings.count)
      }
    }
  }
}
