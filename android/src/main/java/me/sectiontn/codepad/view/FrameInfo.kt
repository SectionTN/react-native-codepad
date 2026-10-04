package me.sectiontn.codepad.view

import android.graphics.RectF

/** Geometry of the last frame in dp. Immutable because the JS thread reads it through a volatile field. */
class FrameInfo(
  val firstLine: Int,
  val lastLine: Int,
  val caret: RectF?,
  val scrollX: Float,
  val scrollY: Float,
  val contentWidth: Float,
  val contentHeight: Float,
) {
  companion object {
    val EMPTY = FrameInfo(0, 0, null, 0f, 0f, 0f, 0f)
  }
}
