package me.sectiontn.codepad.view

import android.view.WindowManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KeyboardInsetTest {
  @Test
  fun overlapIsTheViewBandUnderTheKeyboard() {
    assertEquals(0, KeyboardInset.overlap(viewBottomInWindow = 1000, windowHeight = 2000, imeBottom = 0))
    assertEquals(0, KeyboardInset.overlap(1000, 2000, 900))
    assertEquals(300, KeyboardInset.overlap(1500, 2000, 800))
    assertEquals(800, KeyboardInset.overlap(2000, 2000, 800))
  }

  @Test
  fun adjustPanIsLeftToTheWindow() {
    assertFalse(KeyboardInset.applies(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN))
    assertFalse(
      KeyboardInset.applies(
        WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN or WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE,
      ),
    )
    assertTrue(KeyboardInset.applies(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE))
    assertTrue(
      KeyboardInset.applies(
        WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING or WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE,
      ),
    )
    assertTrue(KeyboardInset.applies(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_UNSPECIFIED))
  }
}
