package me.sectiontn.codepad.view

import kotlin.math.hypot

/**
 * Touch state machine behind CodeEditorView. It sees plain coordinates and timestamps, so taps, long
 * presses, handle drags and scrolls are unit tested without MotionEvent.
 */
class GestureMachine(private val host: Host, private val config: Config) {
  class Config(
    val touchSlop: Float,
    val doubleTapSlop: Float,
    val doubleTapTimeout: Long,
    val longPressTimeout: Long,
  )

  enum class Handle { Insertion, Start, End }

  interface Host {
    fun offsetAt(x: Float, y: Float): Int
    fun handleAt(x: Float, y: Float): Handle?
    fun insideSelection(offset: Int): Boolean
    /** Content deltas: positive dy means the content would move up. */
    fun canScroll(dx: Float, dy: Float): Boolean
    fun placeCaret(offset: Int)
    fun selectWord(offset: Int)
    fun extendWords(offset: Int)
    fun moveHandle(handle: Handle, x: Float, y: Float)
    fun endHandleDrag()
    fun beginScroll()
    fun scrollBy(dx: Float, dy: Float)
    fun endScroll(velocityX: Float, velocityY: Float)
    fun showMenu()
    fun disallowIntercept()
    fun postLongPress(delayMs: Long)
    fun cancelLongPress()
  }

  private enum class State { Idle, Pressed, Passed, Scrolling, HandleDrag, LongPressed, WordDrag }

  private var state = State.Idle
  private var handle: Handle? = null
  private var downX = 0f
  private var downY = 0f
  private var lastX = 0f
  private var lastY = 0f
  private var lastTapTime = -1L
  private var lastTapX = 0f
  private var lastTapY = 0f

  fun down(x: Float, y: Float, time: Long) {
    downX = x
    downY = y
    lastX = x
    lastY = y
    handle = host.handleAt(x, y)
    if (handle != null) {
      state = State.HandleDrag
      host.disallowIntercept()
      return
    }
    state = State.Pressed
    host.postLongPress(config.longPressTimeout)
  }

  fun move(x: Float, y: Float, time: Long) {
    when (state) {
      State.Pressed -> if (hypot(x - downX, y - downY) > config.touchSlop) {
        host.cancelLongPress()
        if (host.canScroll(downX - x, downY - y)) {
          state = State.Scrolling
          host.disallowIntercept()
          host.beginScroll()
          host.scrollBy(lastX - x, lastY - y)
        } else {
          state = State.Passed
        }
      }
      State.Scrolling -> host.scrollBy(lastX - x, lastY - y)
      State.HandleDrag -> handle?.let { host.moveHandle(it, x, y) }
      State.LongPressed -> if (hypot(x - downX, y - downY) > config.touchSlop) {
        state = State.WordDrag
        host.extendWords(host.offsetAt(x, y))
      }
      State.WordDrag -> host.extendWords(host.offsetAt(x, y))
      State.Idle, State.Passed -> {}
    }
    lastX = x
    lastY = y
  }

  fun up(x: Float, y: Float, time: Long, velocityX: Float, velocityY: Float) {
    host.cancelLongPress()
    when (state) {
      State.Pressed -> tap(x, y, time)
      State.Scrolling -> host.endScroll(velocityX, velocityY)
      State.HandleDrag -> host.endHandleDrag()
      State.WordDrag -> host.showMenu()
      State.LongPressed, State.Idle, State.Passed -> {}
    }
    state = State.Idle
  }

  fun cancel() {
    host.cancelLongPress()
    when (state) {
      State.Scrolling -> host.endScroll(0f, 0f)
      State.HandleDrag -> host.endHandleDrag()
      else -> {}
    }
    state = State.Idle
  }

  /** The view's long press timer fired. */
  fun longPress() {
    if (state != State.Pressed) return
    state = State.LongPressed
    host.disallowIntercept()
    host.selectWord(host.offsetAt(downX, downY))
    host.showMenu()
  }

  private fun tap(x: Float, y: Float, time: Long) {
    val offset = host.offsetAt(x, y)
    val doubleTap = lastTapTime >= 0 && time - lastTapTime <= config.doubleTapTimeout &&
      hypot(x - lastTapX, y - lastTapY) <= config.doubleTapSlop
    if (doubleTap) {
      lastTapTime = -1
      host.selectWord(offset)
      return
    }
    lastTapTime = time
    lastTapX = x
    lastTapY = y
    if (host.insideSelection(offset)) host.showMenu() else host.placeCaret(offset)
  }
}
