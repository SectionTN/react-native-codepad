package me.sectiontn.codepad.view

import android.graphics.RectF

/** Empty space a decoration opened under [line], in view dp. */
data class GapRect(val line: Int, val rect: RectF)

/** Geometry of the last frame in dp. Immutable because the JS thread reads it through a volatile field. */
class FrameInfo(
  val firstLine: Int,
  val lastLine: Int,
  val caret: RectF?,
  val scrollX: Float,
  val scrollY: Float,
  val contentWidth: Float,
  val contentHeight: Float,
  val gaps: List<GapRect>,
) {
  companion object {
    val EMPTY = FrameInfo(0, 0, null, 0f, 0f, 0f, 0f, emptyList())
  }
}
