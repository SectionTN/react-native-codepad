enum UnderlineStyle: Sendable {
  case solid
  case wavy
}

/// `offset` is from the baseline to the top of the line. Sizes are points, the color ARGB.
struct Underline: Hashable, Sendable {
  var start: Int
  var end: Int
  var color: UInt32
  var style: UnderlineStyle
  var thickness: Double
  var offset: Double
}

/// Something the app draws over the text.
enum Decoration: Hashable, Sendable {
  case underline(Underline)
  /// `rows` whole rows of empty space under `line`.
  case gap(line: Int, rows: Int)
  case lineBackground(line: Int, color: UInt32)
}
