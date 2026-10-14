package me.sectiontn.codepad.syntax

import org.junit.Assert.assertArrayEquals
import org.junit.Test

class ShiftedSpansTest {
  private val spans = intArrayOf(0, 3, 7, 4, 7, 9)

  // A key inside a token or at its end continues it; the parse decides the real style one frame later.
  @Test
  fun typingInsideOrAtTheEndOfASpanGrowsIt() {
    assertArrayEquals(intArrayOf(0, 4, 7, 5, 8, 9), shiftSpans(spans, 2, 0, 1))
    assertArrayEquals(intArrayOf(0, 4, 7, 5, 8, 9), shiftSpans(spans, 3, 0, 1))
  }

  // A deletion shrinks the span it sits in and moves the rest back; one spanning two tokens cuts both.
  @Test
  fun deletionsShrinkAndReplacementsAcrossSpansCutBoth() {
    assertArrayEquals(intArrayOf(0, 2, 7, 3, 6, 9), shiftSpans(spans, 1, 1, 0))
    assertArrayEquals(intArrayOf(0, 2, 7, 3, 5, 9), shiftSpans(spans, 2, 3, 1))
  }

  // A key right before a token moves it without joining it.
  @Test
  fun typingBeforeASpanShiftsItWithoutJoiningIt() {
    assertArrayEquals(intArrayOf(0, 3, 7, 5, 8, 9), shiftSpans(spans, 4, 0, 1))
  }
}
