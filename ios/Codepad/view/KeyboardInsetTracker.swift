import UIKit

/// Follows the window's keyboard on behalf of one view and reports the points of the view under it. A zero height
/// tracking view pinned to the keyboard layout guide moves with the keyboard; its presentation layer gives the
/// in-flight edge while a notification's animation runs.
@MainActor
final class KeyboardInsetTracker {
  private weak var view: UIView?
  private let apply: (CGFloat) -> Void
  private let trackingView = UIView()
  private var link: CADisplayLink?
  private var deadline: CFTimeInterval = 0
  private(set) var isTracking = false

  init(view: UIView, apply: @escaping (CGFloat) -> Void) {
    self.view = view
    self.apply = apply
    trackingView.isUserInteractionEnabled = false
    trackingView.translatesAutoresizingMaskIntoConstraints = false
  }

  /// Pins the tracking view in the view's window and applies the current overlap; nothing happens outside a window.
  func start() {
    guard !isTracking, let view, let window = view.window else { return }
    isTracking = true
    window.addSubview(trackingView)
    NSLayoutConstraint.activate([
      trackingView.topAnchor.constraint(equalTo: Self.keyboardHost(of: view, in: window).keyboardLayoutGuide.topAnchor),
      trackingView.leadingAnchor.constraint(equalTo: window.leadingAnchor),
      trackingView.trailingAnchor.constraint(equalTo: window.trailingAnchor),
      trackingView.heightAnchor.constraint(equalToConstant: 0),
    ])
    let center = NotificationCenter.default
    for name in [UIResponder.keyboardWillChangeFrameNotification, UIResponder.keyboardWillHideNotification] {
      center.addObserver(self, selector: #selector(keyboardWillMove(_:)), name: name, object: nil)
    }
    window.layoutIfNeeded()
    applyCurrent()
  }

  /// Stops following and clears the inset.
  func stop() {
    guard isTracking else { return }
    isTracking = false
    NotificationCenter.default.removeObserver(self)
    stopLink()
    trackingView.removeFromSuperview()
    apply(0)
  }

  /// Points of the view under a keyboard whose frame is in the window's coordinates.
  func overlap(forKeyboardFrame frame: CGRect) -> CGFloat {
    guard let view, let window = view.window else { return 0 }
    let bottom = view.convert(view.bounds, to: window).maxY
    return KeyboardInset.overlap(viewBottomInWindow: bottom, windowHeight: window.bounds.height, keyboardTop: frame.minY)
  }

  @objc private func keyboardWillMove(_ note: Notification) {
    let duration = note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval ?? 0
    deadline = CACurrentMediaTime() + duration
    if link == nil {
      let link = CADisplayLink(target: self, selector: #selector(tick))
      link.add(to: .main, forMode: .common)
      self.link = link
    }
  }

  /// Reads the presentation layer while the keyboard animates; the last tick applies the end value.
  @objc private func tick() {
    if CACurrentMediaTime() < deadline, let frame = trackingView.layer.presentation()?.frame {
      apply(overlap(forKeyboardFrame: frame))
      return
    }
    stopLink()
    applyCurrent()
  }

  private func applyCurrent() {
    apply(overlap(forKeyboardFrame: trackingView.frame))
  }

  private func stopLink() {
    link?.invalidate()
    link = nil
  }

  /// The window's own guide can sit at a zero frame for good; the guide of the top view under the window follows the keyboard.
  private static func keyboardHost(of view: UIView, in window: UIWindow) -> UIView {
    var host = view
    while let parent = host.superview, parent !== window { host = parent }
    return host
  }
}
