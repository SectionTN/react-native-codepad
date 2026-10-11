package me.sectiontn.codepad.syntax

import org.junit.Assert.assertArrayEquals
import org.junit.Test

class SpansTest {
  // A burst of cancelled edits used to add one region per key, and the next pass ran one query per key.
  @Test
  fun overlappingAndTouchingPairsMergeAndDisjointOnesStaySorted() {
    assertArrayEquals(intArrayOf(0, 6, 8, 9), coalesce(intArrayOf(8, 9, 4, 6, 0, 2, 2, 5)))
  }

  // A deletion's span is zero width; dropping it would leave the deleted tree unreached by the pass.
  @Test
  fun zeroWidthPairsSurviveAndMergeWhenTouched() {
    assertArrayEquals(intArrayOf(3, 3), coalesce(intArrayOf(3, 3)))
    assertArrayEquals(intArrayOf(3, 3, 5, 7), coalesce(intArrayOf(5, 7, 3, 3, 7, 7)))
  }
}
