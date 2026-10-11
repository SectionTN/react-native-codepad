package me.sectiontn.codepad.layout

import org.junit.Assert.assertEquals
import org.junit.Test

class GutterMetricsTest {
  @Test
  fun gutterWidthCountsDigits() {
    assertEquals(1, GutterMetrics.digits(0))
    assertEquals(1, GutterMetrics.digits(9))
    assertEquals(2, GutterMetrics.digits(10))
    assertEquals(4, GutterMetrics.digits(1000))
    assertEquals(30, GutterMetrics.width(42, 7f, 8f))
  }
}
