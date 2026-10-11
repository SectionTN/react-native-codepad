package me.sectiontn.codepad.layout

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ViewportTest {
  private fun viewport(lines: Int = 100, rowHeight: Int = 20, height: Int = 200, width: Int = 400): Viewport =
    Viewport(HeightMap(lines)).apply {
      this.rowHeight = rowHeight
      this.height = height
      this.width = width
    }

  @Test
  fun clampsScrollToTheContent() {
    val v = viewport()
    assertEquals(2000, v.contentHeight)
    assertEquals(1800, v.maxScrollY)
    assertTrue(v.scrollTo(0, 5000))
    assertEquals(1800, v.scrollY)
    assertFalse(v.scrollTo(-10, 1800))
    assertEquals(0, v.scrollX)
    assertEquals(0, v.maxScrollX)
    assertTrue(v.scrollBy(0, -1000))
    assertEquals(800, v.scrollY)
    v.scrollTo(0, 5000)
    v.height = 300
    assertTrue(v.clamp())
    assertEquals(1700, v.scrollY)
  }

  @Test
  fun mapsRowsToViewPixelsThroughInsets() {
    val v = viewport()
    v.insetTop = 30
    v.insetBottom = 50
    assertEquals(120, v.viewportHeight)
    assertEquals(1880, v.maxScrollY)
    assertEquals(30, v.lineTop(0))
    assertEquals(-2, v.rowAt(0))
    v.scrollTo(0, 45)
    assertEquals(2, v.firstVisibleLine())
    assertEquals(25, v.lineTop(2))
    assertEquals(8, v.lastVisibleLine())
    assertEquals(3, v.rowAt(55))
    assertEquals(0, v.rowAt(0))
  }

  @Test
  fun horizontalRangeFollowsTheWidestLine() {
    val v = viewport()
    v.gutterWidth = 40
    v.textPadding = 8
    v.widestLine = 1000
    assertEquals(40, v.textAreaLeft)
    assertEquals(360, v.textAreaWidth)
    assertEquals(1016, v.contentWidth)
    assertEquals(656, v.maxScrollX)
    assertEquals(0, v.wrapWidth)
    assertEquals(100f, v.contentX(148f), 0f)
    v.scrollTo(100, 0)
    assertEquals(-52f, v.viewX(0f), 0f)
    v.wrap = true
    assertEquals(0, v.maxScrollX)
    assertEquals(344, v.wrapWidth)
    assertEquals(360, v.contentWidth)
  }

  @Test
  fun canScrollLooksAtTheDragDirection() {
    val v = viewport()
    assertTrue(v.canScroll(0f, 1f))
    assertFalse(v.canScroll(0f, -1f))
    assertFalse(v.canScroll(1f, 0f))
    v.scrollTo(0, 1800)
    assertFalse(v.canScroll(0f, 1f))
    assertTrue(v.canScroll(0f, -1f))
  }

  @Test
  fun revealScrollsTheMinimumDistance() {
    val v = viewport()
    v.textPadding = 8
    v.widestLine = 1000
    assertTrue(v.reveal(0, 500, 10, 520))
    assertEquals(320, v.scrollY)
    assertTrue(v.reveal(0, 100, 10, 120))
    assertEquals(100, v.scrollY)
    assertFalse(v.reveal(0, 150, 10, 170))
    assertTrue(v.reveal(490, 150, 500, 170))
    assertEquals(116, v.scrollX)
    assertTrue(v.reveal(0, 0, 10, 20))
    assertEquals(0, v.scrollX)
    assertEquals(0, v.scrollY)
  }

  @Test
  fun anchorSurvivesARelayout() {
    val v = viewport()
    v.heights.setRows(3, 4)
    v.scrollTo(0, 80)
    val a = v.anchor()
    assertEquals(3, a.line)
    assertEquals(20, a.offset)
    v.heights.resetAll()
    v.restore(a)
    assertEquals(60, v.scrollY)
    v.heights.setRows(3, 4)
    v.restore(a)
    assertEquals(80, v.scrollY)
  }

  @Test
  fun measuringALineAboveKeepsTheViewportStill() {
    val v = viewport()
    v.scrollTo(0, 400)
    assertEquals(20, v.firstVisibleLine())
    v.measured(5, 3)
    assertEquals(440, v.scrollY)
    assertEquals(20, v.firstVisibleLine())
    v.measured(20, 2)
    assertEquals(440, v.scrollY)
    v.measured(5, 3)
    assertEquals(440, v.scrollY)
  }

  @Test
  fun resizeAndInsetsReportOnlyTextAreaWidthChanges() {
    val v = viewport()
    assertFalse(v.resize(400, 300))
    assertEquals(300, v.height)
    assertTrue(v.resize(500, 300))
    assertEquals(500, v.width)
    assertFalse(v.setInsets(10, 20, 0, 0))
    assertEquals(20, v.insetBottom)
    assertTrue(v.setInsets(10, 20, 8, 0))
    assertEquals(8, v.insetLeft)
    assertTrue(v.setInsets(10, 20, 8, 4))
    assertFalse(v.setInsets(0, 0, 8, 4))
  }
}
