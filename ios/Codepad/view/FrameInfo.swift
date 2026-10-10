import CoreGraphics

/// Geometry of the last frame in points. Immutable so the JS thread can read it under the view's lock.
struct FrameInfo: Sendable {
  let firstLine: Int
  let lastLine: Int
  let caret: CGRect?
  let scrollX: CGFloat
  let scrollY: CGFloat
  let contentWidth: CGFloat
  let contentHeight: CGFloat

  static let empty = FrameInfo(
    firstLine: 0, lastLine: 0, caret: nil, scrollX: 0, scrollY: 0, contentWidth: 0, contentHeight: 0)
}
