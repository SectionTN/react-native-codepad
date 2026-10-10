import Foundation

/// What the editor does with the machine's decisions. The view conforms on the main actor.
protocol GestureHost: AnyObject {
  func offsetAt(x: CGFloat, y: CGFloat) -> Int
  func insideSelection(_ offset: Int) -> Bool
  func caretHit(x: CGFloat, y: CGFloat) -> Bool
  func placeCaret(_ offset: Int)
  func selectWord(_ offset: Int)
  func selectLine(_ offset: Int)
  func beginLoupe(x: CGFloat, y: CGFloat)
  func moveLoupe(x: CGFloat, y: CGFloat)
  func endLoupe()
  func showMenu()
  func yieldToScroll()
  func postLongPress(delay: TimeInterval)
  func cancelLongPress()
}

/// Touch state machine behind the editor's gesture recognizer. It sees plain points and timestamps, so taps,
/// long presses and the loupe drag are unit tested without UITouch. Handles have their own recognizers.
final class GestureMachine {
  struct Config: Sendable {
    let touchSlop: CGFloat
    let doubleTapSlop: CGFloat
    let doubleTapTimeout: TimeInterval
    let longPressTimeout: TimeInterval

    init(touchSlop: CGFloat, doubleTapSlop: CGFloat, doubleTapTimeout: TimeInterval, longPressTimeout: TimeInterval) {
      self.touchSlop = touchSlop
      self.doubleTapSlop = doubleTapSlop
      self.doubleTapTimeout = doubleTapTimeout
      self.longPressTimeout = longPressTimeout
    }
  }

  private enum State {
    case idle
    case pressed
    case passed
    case loupe
  }

  private unowned let host: any GestureHost
  private let config: Config
  private var state = State.idle
  private var downX: CGFloat = 0
  private var downY: CGFloat = 0
  private var lastTapTime: TimeInterval = -1
  private var lastTapX: CGFloat = 0
  private var lastTapY: CGFloat = 0
  private var tapCount = 0

  init(host: any GestureHost, config: Config) {
    self.host = host
    self.config = config
  }

  func down(x: CGFloat, y: CGFloat, time: TimeInterval) {
    downX = x
    downY = y
    state = .pressed
    host.postLongPress(delay: config.longPressTimeout)
  }

  func move(x: CGFloat, y: CGFloat, time: TimeInterval) {
    switch state {
    case .pressed:
      if distance(x - downX, y - downY) > config.touchSlop {
        host.cancelLongPress()
        state = .passed
        host.yieldToScroll()
      }
    case .loupe:
      host.placeCaret(host.offsetAt(x: x, y: y))
      host.moveLoupe(x: x, y: y)
    case .idle, .passed:
      break
    }
  }

  func up(x: CGFloat, y: CGFloat, time: TimeInterval) {
    host.cancelLongPress()
    switch state {
    case .pressed:
      tap(x: x, y: y, time: time)
    case .loupe:
      host.endLoupe()
      host.showMenu()
    case .idle, .passed:
      break
    }
    state = .idle
  }

  func cancel() {
    host.cancelLongPress()
    if state == .loupe { host.endLoupe() }
    state = .idle
  }

  /// The view's long press timer fired.
  func longPress() {
    if state != .pressed { return }
    state = .loupe
    host.placeCaret(host.offsetAt(x: downX, y: downY))
    host.beginLoupe(x: downX, y: downY)
  }

  private func tap(x: CGFloat, y: CGFloat, time: TimeInterval) {
    let offset = host.offsetAt(x: x, y: y)
    let chained =
      lastTapTime >= 0 && time - lastTapTime <= config.doubleTapTimeout
      && distance(x - lastTapX, y - lastTapY) <= config.doubleTapSlop
    tapCount = chained ? tapCount + 1 : 1
    lastTapTime = time
    lastTapX = x
    lastTapY = y
    switch tapCount {
    case 2:
      host.selectWord(offset)
    case 3:
      // The chain restarts after a triple tap, so a fourth tap is a plain tap again.
      lastTapTime = -1
      host.selectLine(offset)
    default:
      if host.caretHit(x: x, y: y) || host.insideSelection(offset) { host.showMenu() } else { host.placeCaret(offset) }
    }
  }

  private func distance(_ dx: CGFloat, _ dy: CGFloat) -> CGFloat {
    (dx * dx + dy * dy).squareRoot()
  }
}
