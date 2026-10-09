package me.sectiontn.codepad.view

import android.view.WindowManager

/** The arithmetic behind KeyboardInsetTracker, kept pure so JUnit covers it. */
internal object KeyboardInset {
  /** Pixels of the view covered by the keyboard, both measured in window coordinates. */
  fun overlap(viewBottomInWindow: Int, windowHeight: Int, imeBottom: Int): Int =
    maxOf(0, viewBottomInWindow - (windowHeight - imeBottom))

  /** adjustPan moves the whole window instead, so an inset on top of it would double the avoidance. */
  fun applies(softInputMode: Int): Boolean =
    softInputMode and WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST != WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN
}
