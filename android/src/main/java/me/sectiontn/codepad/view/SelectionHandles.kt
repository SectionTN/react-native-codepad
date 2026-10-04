package me.sectiontn.codepad.view

import android.content.Context
import android.graphics.Canvas
import android.graphics.Rect
import android.graphics.drawable.Drawable

/** The platform text selection handles, tinted with the theme cursor color and placed by the view each frame. */
class SelectionHandles(context: Context) {
  private val insertion = resolve(context, android.R.attr.textSelectHandle)
  private val start = resolve(context, android.R.attr.textSelectHandleLeft)
  private val end = resolve(context, android.R.attr.textSelectHandleRight)
  private val insertionBounds = Rect()
  private val startBounds = Rect()
  private val endBounds = Rect()

  var insertionVisible = false
  var selectionVisible = false

  fun setColor(color: Int) {
    insertion?.setTint(color)
    start?.setTint(color)
    end?.setTint(color)
  }

  /** Anchors are the bottom of the caret row. Hotspots match EditText: center, three quarters, one quarter. */
  fun placeInsertion(x: Float, y: Float) = place(insertion, insertionBounds, x, y, 0.5f)

  fun placeStart(x: Float, y: Float) = place(start, startBounds, x, y, 0.75f)

  fun placeEnd(x: Float, y: Float) = place(end, endBounds, x, y, 0.25f)

  fun hideInsertion() = insertionBounds.setEmpty()

  fun hideStart() = startBounds.setEmpty()

  fun hideEnd() = endBounds.setEmpty()

  fun draw(canvas: Canvas) {
    if (insertionVisible && !insertionBounds.isEmpty) insertion?.draw(canvas)
    if (selectionVisible) {
      if (!startBounds.isEmpty) start?.draw(canvas)
      if (!endBounds.isEmpty) end?.draw(canvas)
    }
  }

  fun hitTest(x: Float, y: Float): GestureMachine.Handle? {
    val px = x.toInt()
    val py = y.toInt()
    if (selectionVisible) {
      if (startBounds.contains(px, py)) return GestureMachine.Handle.Start
      if (endBounds.contains(px, py)) return GestureMachine.Handle.End
    }
    if (insertionVisible && insertionBounds.contains(px, py)) return GestureMachine.Handle.Insertion
    return null
  }

  /** Top edge of a handle, which is the bottom of the row it points at. */
  fun top(handle: GestureMachine.Handle): Int = when (handle) {
    GestureMachine.Handle.Insertion -> insertionBounds.top
    GestureMachine.Handle.Start -> startBounds.top
    GestureMachine.Handle.End -> endBounds.top
  }

  private fun place(drawable: Drawable?, out: Rect, x: Float, y: Float, hotspot: Float) {
    if (drawable == null) {
      out.setEmpty()
      return
    }
    val w = drawable.intrinsicWidth
    val h = drawable.intrinsicHeight
    val left = Math.round(x - w * hotspot)
    val top = Math.round(y)
    out.set(left, top, left + w, top + h)
    drawable.bounds = out
  }

  private companion object {
    fun resolve(context: Context, attr: Int): Drawable? {
      val a = context.obtainStyledAttributes(intArrayOf(attr))
      val d = a.getDrawable(0)?.mutate()
      a.recycle()
      return d
    }
  }
}
