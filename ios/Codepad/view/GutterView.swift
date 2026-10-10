import CoreText
import UIKit

/// The line numbers beside the text. Sticky in the frame loop, which hands it the rows to draw.
final class GutterView: UIView {
  struct Row {
    let number: Int
    let top: CGFloat
    let active: Bool
  }

  var theme = ThemeColors.default {
    didSet { backgroundColor = UIColor(cgColor: theme.gutterBackground) }
  }
  var metrics: RowMetrics?
  var padding: CGFloat = 0
  private var rows: [Row] = []

  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = true
    isUserInteractionEnabled = false
    contentMode = .redraw
    backgroundColor = UIColor(cgColor: theme.gutterBackground)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func update(_ rows: [Row]) {
    self.rows = rows
    setNeedsDisplay()
  }

  override func draw(_ rect: CGRect) {
    guard let ctx = UIGraphicsGetCurrentContext(), let m = metrics else { return }
    ctx.setFillColor(theme.gutterBackground)
    ctx.fill(bounds)
    let right = bounds.width - padding
    for row in rows {
      let color = row.active ? theme.gutterActiveForeground : theme.gutterForeground
      let text = NSAttributedString(
        string: String(row.number),
        attributes: [
          NSAttributedString.Key(kCTFontAttributeName as String): m.font,
          NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
        ])
      let line = CTLineCreateWithAttributedString(text)
      let width = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
      ctx.saveGState()
      ctx.textMatrix = .identity
      ctx.translateBy(x: right - width, y: row.top + m.ascent)
      ctx.scaleBy(x: 1, y: -1)
      ctx.textPosition = .zero
      CTLineDraw(line, ctx)
      ctx.restoreGState()
    }
  }
}
