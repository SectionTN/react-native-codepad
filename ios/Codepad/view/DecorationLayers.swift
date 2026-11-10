import QuartzCore

/// Chrome's wavy underline in points, measured at 14 px for thickness 1 to 4.
enum WaveGeometry {
  static func wavelength(_ thickness: CGFloat) -> CGFloat { 4 * thickness + 0.375 }

  /// How far the centre line swings to either side.
  static func amplitude(_ thickness: CGFloat) -> CGFloat { 0.875 * thickness }

  /// How far the centre line sits below a solid line's top.
  static func centre(_ thickness: CGFloat) -> CGFloat { thickness }

  /// One quadratic per half wave, leaving `left` on the centre line heading down and stopping exactly at `right`.
  static func add(to path: CGMutablePath, left: CGFloat, right: CGFloat, centre: CGFloat, thickness: CGFloat) {
    let half = wavelength(thickness) / 2
    let swing = 2 * amplitude(thickness)
    path.move(to: CGPoint(x: left, y: centre))
    var x = left
    var down = true
    while x < right {
      let start = CGPoint(x: x, y: centre)
      let control = CGPoint(x: x + half / 2, y: down ? centre + swing : centre - swing)
      let end = CGPoint(x: x + half, y: centre)
      if end.x <= right {
        path.addQuadCurve(to: end, control: control)
      } else {
        // The control sits halfway across, so x is linear in t and the split lands exactly on `right`.
        let t = (right - x) / half
        let q = lerp(start, control, t)
        path.addQuadCurve(to: lerp(q, lerp(control, end, t), t), control: q)
      }
      x += half
      down.toggle()
    }
  }

  private static func lerp(_ a: CGPoint, _ b: CGPoint, _ t: CGFloat) -> CGPoint {
    CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t)
  }
}

/// The app's line backgrounds and underlines: one shape layer per color, or per color and width for waves,
/// reused from frame to frame. Paths are in content coordinates like the fills.
final class DecorationLayers {
  /// Above the active line, below the search and selection fills.
  let backgrounds = StillLayer()
  /// Above the fills and the selection, below the text.
  let underlines = StillLayer()
  private var backgroundShapes: [StillShapeLayer] = []
  private var underlineShapes: [StillShapeLayer] = []

  /// A shape's paint: a fill when `width` is 0, else a stroke of that width.
  struct Paint: Hashable {
    let color: UInt32
    let width: CGFloat
  }

  /// Paths grouped by paint in the order each paint first appears.
  struct Batch {
    private(set) var paints: [Paint] = []
    private(set) var paths: [Paint: CGMutablePath] = [:]

    mutating func path(_ paint: Paint) -> CGMutablePath {
      if let p = paths[paint] { return p }
      let p = CGMutablePath()
      paints.append(paint)
      paths[paint] = p
      return p
    }
  }

  func set(backgrounds b: Batch, underlines u: Batch) {
    DecorationLayers.place(b, in: backgrounds, pool: &backgroundShapes)
    DecorationLayers.place(u, in: underlines, pool: &underlineShapes)
  }

  func clear() {
    set(backgrounds: Batch(), underlines: Batch())
  }

  private static func place(_ batch: Batch, in host: CALayer, pool: inout [StillShapeLayer]) {
    while pool.count < batch.paints.count {
      let shape = StillShapeLayer()
      host.addSublayer(shape)
      pool.append(shape)
    }
    for (i, shape) in pool.enumerated() {
      guard i < batch.paints.count else {
        shape.isHidden = true
        continue
      }
      let paint = batch.paints[i]
      let color = DecorationLayers.color(paint.color)
      shape.path = batch.paths[paint]
      shape.fillColor = paint.width == 0 ? color : nil
      shape.strokeColor = paint.width == 0 ? nil : color
      shape.lineWidth = paint.width
      shape.isHidden = false
    }
  }

  /// ARGB to an sRGB color, the space the theme colors use.
  private static func color(_ argb: UInt32) -> CGColor {
    ThemeColors.color(
      Int((argb >> 16) & 0xff), Int((argb >> 8) & 0xff), Int(argb & 0xff), CGFloat((argb >> 24) & 0xff) / 255)
  }
}
