import QuartzCore

/// The fills under the text: the active line, the search matches with the active one, and the bracket pair.
final class Decorations {
  let activeLine = StillLayer()
  let matches = StillShapeLayer()
  let activeMatch = StillShapeLayer()
  let brackets = StillShapeLayer()

  /// Bottom to top.
  var layers: [CALayer] { [activeLine, matches, activeMatch, brackets] }

  init() {
    for layer in layers { layer.isHidden = true }
  }

  func setTheme(_ theme: ThemeColors) {
    activeLine.backgroundColor = theme.activeLine
    matches.fillColor = theme.searchMatch
    activeMatch.fillColor = theme.searchMatchActive
    brackets.fillColor = theme.matchingBracket
  }

  func setActiveLine(_ rect: CGRect?) {
    activeLine.isHidden = rect == nil
    if let rect, activeLine.frame != rect { activeLine.frame = rect }
  }

  func setBrackets(_ path: CGPath?) {
    brackets.path = path
    brackets.isHidden = path == nil
  }

  func setMatches(_ path: CGPath?, active: CGPath?) {
    matches.path = path
    matches.isHidden = path == nil
    activeMatch.path = active
    activeMatch.isHidden = active == nil
  }

  /// Calls `out` with one rect per row of [start, end).
  static func forEachRect(_ g: RowGeometry, start: Int, end: Int, firstLine: Int, _ out: (CGRect) -> Void) {
    RangeRects.forEach(g, start: start, end: end, firstLine: firstLine) { left, top, right, bottom in
      out(CGRect(x: left, y: top, width: right - left, height: bottom - top))
    }
  }

  /// Appends one rect per row of [start, end) to `path`.
  static func addRects(_ path: CGMutablePath, _ g: RowGeometry, start: Int, end: Int, firstLine: Int) {
    forEachRect(g, start: start, end: end, firstLine: firstLine) { path.addRect($0) }
  }
}

/// Layers placed by hand every frame, so implicit animations are off.
final class StillLayer: CALayer {
  override func action(forKey event: String) -> CAAction? {
    nil
  }
}

final class StillShapeLayer: CAShapeLayer {
  override func action(forKey event: String) -> CAAction? {
    nil
  }
}
