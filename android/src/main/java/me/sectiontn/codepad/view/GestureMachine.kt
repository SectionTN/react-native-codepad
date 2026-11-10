package me.sectiontn.codepad.view

import kotlin.math.abs
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
    /** True over empty space a decoration opened under a line, where taps leave the caret alone. */
    fun inGap(x: Float, y: Float): Boolean = false
    fun handleAt(x: Float, y: Float): Handle?
    fun insideSelection(offset: Int): Boolean
    /** Off leaves vertical drags to the parent and scrolls only sideways. */
    val scrollsVertically: Boolean get() = true
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
    /** Keeps a vertical parent from intercepting without taking the touch, which gesture-handler roots read as a grab. */
    fun holdParent() {}
    fun releaseParent() {}
    fun postLongPress(delayMs: Long)
    fun cancelLongPress()
  }

  private enum class State { Idle, Pressed, Passed, Scrolling, HandleDrag, LongPressed, WordDrag }

  private var state = State.Idle
  private var handle: Handle? = null
  private var holdingParent = false
  private var downX = 0f
  private var downY = 0f
  private var lastX = 0f
  private var lastY = 0f
  private var lastTapTime = -1L
  private var lastTapX = 0f
  private var lastTapY = 0f

  fun down(x: Float, y: Float, time: Long) {
    holdingParent = false
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
    // A parent ScrollView intercepts on its own slop, before the axis is known: hold it until then.
    if (!host.scrollsVertically && (host.canScroll(1f, 0f) || host.canScroll(-1f, 0f))) {
      host.holdParent()
      holdingParent = true
    }
  }

  fun move(x: Float, y: Float, time: Long) {
    when (state) {
      State.Pressed -> if (hypot(x - downX, y - downY) > config.touchSlop) {
        host.cancelLongPress()
        if (claims(downX - x, downY - y)) {
          state = State.Scrolling
          host.disallowIntercept()
          releaseHold()
          host.beginScroll()
          scrollBy(lastX - x, lastY - y)
        } else {
          state = State.Passed
          releaseHold()
        }
      }
      State.Scrolling -> scrollBy(lastX - x, lastY - y)
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
    releaseHold()
    when (state) {
      State.Pressed -> tap(x, y, time)
      State.Scrolling -> host.endScroll(velocityX, if (host.scrollsVertically) velocityY else 0f)
      State.HandleDrag -> host.endHandleDrag()
      State.WordDrag -> host.showMenu()
      State.LongPressed, State.Idle, State.Passed -> {}
    }
    state = State.Idle
  }

  fun cancel() {
    host.cancelLongPress()
    releaseHold()
    when (state) {
      State.Scrolling -> host.endScroll(0f, 0f)
      State.HandleDrag -> host.endHandleDrag()
      else -> {}
    }
    state = State.Idle
  }

  /** The view's long press timer fired. */
  fun longPress() {
    if (state != State.Pressed || host.inGap(downX, downY)) return
    state = State.LongPressed
    host.disallowIntercept()
    host.selectWord(host.offsetAt(downX, downY))
    host.showMenu()
  }

  private fun releaseHold() {
    if (holdingParent) host.releaseParent()
    holdingParent = false
  }

  private fun claims(dx: Float, dy: Float): Boolean =
    if (host.scrollsVertically) host.canScroll(dx, dy) else abs(dx) > abs(dy) && host.canScroll(dx, 0f)

  private fun scrollBy(dx: Float, dy: Float) = host.scrollBy(dx, if (host.scrollsVertically) dy else 0f)

  private fun tap(x: Float, y: Float, time: Long) {
    if (host.inGap(x, y)) return
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
