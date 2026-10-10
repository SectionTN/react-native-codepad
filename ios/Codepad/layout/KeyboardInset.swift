import CoreGraphics

/// The arithmetic behind KeyboardInsetTracker, kept pure so swift test covers it.
enum KeyboardInset {
  /// Points of the view covered by the keyboard, both measured in window coordinates. A keyboard frame
  /// below the window (hidden) counts as the window bottom.
  static func overlap(viewBottomInWindow: CGFloat, windowHeight: CGFloat, keyboardTop: CGFloat) -> CGFloat {
    max(0, viewBottomInWindow - min(keyboardTop, windowHeight))
  }
}
