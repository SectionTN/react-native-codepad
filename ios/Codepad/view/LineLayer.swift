import QuartzCore

/// One visible line's rows drawn from a LineLayout. The frame may be a window into a huge line, so the
/// layout is drawn shifted by `offset`.
final class LineLayer: CALayer {
  var layout: LineLayout?
  /// Where the layer's origin sits relative to the line's own origin, in points.
  var offset = CGPoint.zero
  var padding: CGFloat = 0

  override func action(forKey event: String) -> CAAction? {
    nil
  }

  override func draw(in ctx: CGContext) {
    guard let layout else { return }
    ctx.translateBy(x: padding - offset.x, y: -offset.y)
    layout.draw(in: ctx, top: 0)
  }
}
