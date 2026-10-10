import UIKit
import UIKit.UIGestureRecognizerSubclass

/// Feeds one finger into the gesture machine and carries its decisions as recognizer states: a tap recognizes
/// on release, the long press begins the loupe drag, a yield fails it so the scroll view's pan takes the touch.
final class EditorGestureRecognizer: UIGestureRecognizer {
  let machine: GestureMachine
  private var longPress: Timer?

  init(host: any GestureHost, config: GestureMachine.Config) {
    machine = GestureMachine(host: host, config: config)
    super.init(target: nil, action: nil)
  }

  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
    super.touchesBegan(touches, with: event)
    // Handles have their own pans; a second finger belongs to the scroll view.
    guard numberOfTouches == 1, let touch = touches.first, !(touch.view is HandleView) else {
      machine.cancel()
      state = state == .possible ? .failed : .cancelled
      return
    }
    let point = touch.location(in: view)
    machine.down(x: point.x, y: point.y, time: touch.timestamp)
  }

  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
    super.touchesMoved(touches, with: event)
    guard let touch = touches.first else { return }
    let point = touch.location(in: view)
    machine.move(x: point.x, y: point.y, time: touch.timestamp)
    if state == .began || state == .changed { state = .changed }
  }

  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
    super.touchesEnded(touches, with: event)
    guard let touch = touches.first else { return }
    let point = touch.location(in: view)
    machine.up(x: point.x, y: point.y, time: touch.timestamp)
    if state == .possible || state == .began || state == .changed { state = .ended }
  }

  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
    super.touchesCancelled(touches, with: event)
    machine.cancel()
    state = state == .possible ? .failed : .cancelled
  }

  override func reset() {
    super.reset()
    machine.cancel()
  }

  /// The machine yielded: fail now so the scroll view's pan runs with the whole touch.
  func yield() {
    cancelLongPress()
    if state == .possible { state = .failed }
  }

  func postLongPress(delay: TimeInterval) {
    cancelLongPress()
    let timer = Timer(timeInterval: delay, repeats: false) { [weak self] _ in
      MainActor.assumeIsolated { self?.longPressFired() }
    }
    RunLoop.main.add(timer, forMode: .common)
    longPress = timer
  }

  func cancelLongPress() {
    longPress?.invalidate()
    longPress = nil
  }

  private func longPressFired() {
    longPress = nil
    machine.longPress()
    if state == .possible { state = .began }
  }
}
