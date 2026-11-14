package me.sectiontn.codepad.view

import android.content.Context
import android.graphics.Canvas
import android.view.View
import android.view.animation.AnimationUtils
import android.widget.EdgeEffect
import android.widget.OverScroller
import kotlin.math.roundToInt

/** Fling physics and the four edge glows. The view keeps the scroll position, this only animates it. */
class ScrollController(context: Context, private val view: View) {
  private val scroller = OverScroller(context)
  private val top = EdgeEffect(context)
  private val bottom = EdgeEffect(context)
  private val left = EdgeEffect(context)
  private val right = EdgeEffect(context)

  // The animateTo target, read again every frame.
  private var target: (() -> Int)? = null
  private var aimed = false
  private var aimX = 0
  private var aimY = 0
  private var fromY = 0
  private var started = 0L

  val isFinished: Boolean get() = target == null && scroller.isFinished
  val currX: Int get() = if (aimed) aimX else scroller.currX
  val currY: Int get() = if (aimed) aimY else scroller.currY
  val currVelocity: Float get() = scroller.currVelocity

  /** True between fling() and the next abort() or animateTo(), so only flings light the edges up. */
  var flinging = false
    private set

  fun setColor(color: Int) {
    top.color = color
    bottom.color = color
    left.color = color
    right.color = color
  }

  fun setSize(width: Int, height: Int) {
    top.setSize(width, height)
    bottom.setSize(width, height)
    left.setSize(height, width)
    right.setSize(height, width)
  }

  fun fling(startX: Int, startY: Int, velocityX: Int, velocityY: Int, maxX: Int, maxY: Int) {
    abort()
    flinging = true
    scroller.fling(startX, startY, velocityX, velocityY, 0, maxX, 0, maxY)
    view.postInvalidateOnAnimation()
  }

  /** Scrolls vertically to [y], which can move while the scroll runs: wrapped lines take their rows on the way. */
  fun animateTo(startX: Int, startY: Int, y: () -> Int) {
    abort()
    target = y
    aimed = true
    aimX = startX
    aimY = startY
    fromY = startY
    started = AnimationUtils.currentAnimationTimeMillis()
    view.postInvalidateOnAnimation()
  }

  fun abort() {
    flinging = false
    scroller.abortAnimation()
    target = null
    aimed = false
  }

  /** Advances a running animation. False once it is finished. */
  fun step(): Boolean {
    val y = target ?: return scroller.computeScrollOffset()
    val t = ((AnimationUtils.currentAnimationTimeMillis() - started).toFloat() / SCROLL_DURATION_MS).coerceAtMost(1f)
    val eased = 1 - (1 - t) * (1 - t) * (1 - t)
    aimY = fromY + ((y() - fromY) * eased).roundToInt()
    if (t >= 1f) target = null
    return true
  }

  /** A drag went past an edge by (dx, dy) px with the finger at (x, y). */
  fun pull(dx: Float, dy: Float, x: Float, y: Float, width: Int, height: Int) {
    if (dy < 0) top.onPull(-dy / height, x / width) else if (dy > 0) bottom.onPull(dy / height, 1 - x / width)
    if (dx < 0) left.onPull(-dx / width, 1 - y / height) else if (dx > 0) right.onPull(dx / width, y / height)
    view.postInvalidateOnAnimation()
  }

  fun release() {
    top.onRelease()
    bottom.onRelease()
    left.onRelease()
    right.onRelease()
  }

  fun absorbTop(velocity: Int) = top.onAbsorb(velocity)

  fun absorbBottom(velocity: Int) = bottom.onAbsorb(velocity)

  fun absorbLeft(velocity: Int) = left.onAbsorb(velocity)

  fun absorbRight(velocity: Int) = right.onAbsorb(velocity)

  /** Draws the glows in view coordinates. True while one is still animating. */
  fun draw(canvas: Canvas, width: Int, height: Int): Boolean {
    var more = false
    if (!top.isFinished) more = top.draw(canvas) || more
    if (!bottom.isFinished) {
      canvas.save()
      canvas.rotate(180f, width / 2f, height / 2f)
      more = bottom.draw(canvas) || more
      canvas.restore()
    }
    if (!left.isFinished) {
      canvas.save()
      canvas.rotate(270f)
      canvas.translate(-height.toFloat(), 0f)
      more = left.draw(canvas) || more
      canvas.restore()
    }
    if (!right.isFinished) {
      canvas.save()
      canvas.rotate(90f)
      canvas.translate(0f, -width.toFloat())
      more = right.draw(canvas) || more
      canvas.restore()
    }
    return more
  }

  companion object {
    const val SCROLL_DURATION_MS = 250
  }
}
