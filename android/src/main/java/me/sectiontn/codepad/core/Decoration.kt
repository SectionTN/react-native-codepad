package me.sectiontn.codepad.core

enum class UnderlineStyle { Solid, Wavy }

/** Something the app draws over the text. Sizes are dp, colors ARGB. */
sealed interface Decoration

/** [offset] is from the baseline to the top of the line. */
data class Underline(
  val start: Int,
  val end: Int,
  val color: Int,
  val style: UnderlineStyle,
  val thickness: Float,
  val offset: Float,
) : Decoration

/** [rows] whole rows of empty space under [line]. */
data class Gap(val line: Int, val rows: Int) : Decoration

data class LineBackground(val line: Int, val color: Int) : Decoration
