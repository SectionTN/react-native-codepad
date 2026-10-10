import UIKit

/// A position in the document as a UTF-16 offset, what UIKit hands back to the view.
final class CPTextPosition: UITextPosition {
  let offset: Int

  init(offset: Int) {
    self.offset = offset
    super.init()
  }
}

/// An ordered [start, end) range of UTF-16 offsets.
final class CPTextRange: UITextRange {
  let startOffset: Int
  let endOffset: Int

  init(start: Int, end: Int) {
    startOffset = min(start, end)
    endOffset = max(start, end)
    super.init()
  }

  override var start: UITextPosition { CPTextPosition(offset: startOffset) }
  override var end: UITextPosition { CPTextPosition(offset: endOffset) }
  override var isEmpty: Bool { startOffset == endOffset }
}

/// One row of a selection in content view coordinates.
final class CPSelectionRect: UITextSelectionRect {
  private let value: CGRect
  private let first: Bool
  private let last: Bool

  init(rect: CGRect, containsStart: Bool, containsEnd: Bool) {
    value = rect
    first = containsStart
    last = containsEnd
    super.init()
  }

  override var rect: CGRect { value }
  override var writingDirection: NSWritingDirection { .leftToRight }
  override var containsStart: Bool { first }
  override var containsEnd: Bool { last }
  override var isVertical: Bool { false }
}

/// The selection fill under the text, one path of row rects in the theme's selection color.
final class HighlightView: UIView, UITextSelectionHighlightView {
  private let shape = StillShapeLayer()

  var selectionRects: [UITextSelectionRect] = [] {
    didSet {
      let path = CGMutablePath()
      for rect in selectionRects { path.addRect(rect.rect) }
      shape.path = path
    }
  }

  var fillColor: CGColor? { shape.fillColor }

  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false
    isUserInteractionEnabled = false
    layer.addSublayer(shape)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func apply(theme: ThemeColors) {
    shape.fillColor = theme.selection
  }
}

/// The caret: 2 pt wide in the theme's cursor color, blinking while the interaction says so, invisible under read only.
final class CursorView: UIView, UITextCursorView {
  private(set) var color: CGColor = ThemeColors.default.cursor

  var readOnly = false {
    didSet { alpha = readOnly ? 0 : 1 }
  }

  var isBlinking = false {
    didSet { if isBlinking { startBlink() } else { layer.removeAnimation(forKey: "blink") } }
  }

  override var isHidden: Bool {
    get { super.isHidden || readOnly }
    set { super.isHidden = newValue }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    isUserInteractionEnabled = false
    backgroundColor = UIColor(cgColor: color)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  func resetBlinkAnimation() {
    layer.removeAnimation(forKey: "blink")
    if isBlinking { startBlink() }
  }

  func apply(theme: ThemeColors) {
    color = theme.cursor
    backgroundColor = UIColor(cgColor: color)
  }

  private func startBlink() {
    let blink = CAKeyframeAnimation(keyPath: "opacity")
    blink.values = [1, 1, 0, 0]
    blink.keyTimes = [0, 0.5, 0.5, 1]
    blink.duration = 1
    blink.repeatCount = .infinity
    layer.add(blink, forKey: "blink")
  }
}

/// A selection handle: a knob above the bar for the leading end, below it for the trailing end, in cursor color.
final class HandleView: UIView, UITextSelectionHandleView {
  static let knob: CGFloat = 10
  static let bar: CGFloat = 2

  private let knobLayer = StillShapeLayer()
  private let barLayer = StillLayer()
  private(set) var color: CGColor = ThemeColors.default.cursor
  var customShape: UIBezierPath?
  var isVertical: Bool { false }

  var direction: NSDirectionalRectEdge = .leading {
    didSet { setNeedsLayout() }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false
    layer.addSublayer(barLayer)
    layer.addSublayer(knobLayer)
    apply(theme: .default)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  /// `rect` is the caret rect of the selection end; the handle wraps it plus the knob.
  func preferredFrame(for rect: CGRect) -> CGRect {
    let knob = HandleView.knob
    let y = direction == .leading ? rect.minY - knob : rect.minY
    return CGRect(x: rect.midX - knob / 2, y: y, width: knob, height: rect.height + knob)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let knob = HandleView.knob
    let bar = HandleView.bar
    let leading = direction == .leading
    knobLayer.frame = CGRect(x: 0, y: leading ? 0 : bounds.height - knob, width: knob, height: knob)
    knobLayer.path = CGPath(ellipseIn: knobLayer.bounds, transform: nil)
    barLayer.frame = CGRect(x: (knob - bar) / 2, y: leading ? knob : 0, width: bar, height: max(0, bounds.height - knob))
  }

  func apply(theme: ThemeColors) {
    color = theme.cursor
    knobLayer.fillColor = color
    barLayer.backgroundColor = color
  }
}
