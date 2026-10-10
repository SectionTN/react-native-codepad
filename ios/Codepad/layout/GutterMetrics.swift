import CoreGraphics

enum GutterMetrics {
  static func digits(_ lineCount: Int) -> Int {
    var n = max(lineCount, 1)
    var d = 0
    while n > 0 {
      d += 1
      n /= 10
    }
    return d
  }

  /// Digit columns for the last line number plus padding on both sides.
  static func width(lineCount: Int, digitAdvance: CGFloat, padding: CGFloat) -> Int {
    Int((CGFloat(digits(lineCount)) * digitAdvance + 2 * padding).rounded())
  }
}
