package me.sectiontn.codepad.layout

import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.core.Gap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ViewportTest {
  private fun lines(n: Int) = EditorCore(List(n) { "line $it" }.joinToString("\n"))

  @Test
  fun canScrollLooksAtTheDragDirection() {
    lines(100).use { core ->
      val v = Viewport()
      v.attach(core)
      v.rowHeight = 20
      v.resize(400, 200)
      assertTrue(v.canScroll(0f, 1f))
      assertFalse(v.canScroll(0f, -1f))
      assertFalse(v.canScroll(1f, 0f))
      v.scrollTo(0, 1800)
      assertFalse(v.canScroll(0f, 1f))
      assertTrue(v.canScroll(0f, -1f))
      v.close()
    }
  }

  // Between measure and endDraw the painters read the draw's copy. A copy that drifts from the core puts a line, the
  // gutter or a gap at the wrong height, and a read that still crosses costs a JNI call per line.
  @Test
  fun drawReadsMatchTheCoreWithoutCalls() {
    lines(60).use { core ->
      assertTrue(core.setDecorations(listOf(Gap(2, 2), Gap(21, 1), Gap(50, 3)), -1))
      val v = Viewport()
      v.attach(core)
      v.rowHeight = 10
      v.resize(100, 60)
      v.setInsets(7, 5, 3, 0)
      v.gutterWidth = 20
      v.scrollTo(0, 205)
      val first = v.firstVisibleLine()
      val last = first + 60 / 10 + 1
      v.beginDraw(checksCalls = true)
      v.measure(intArrayOf(first - 3, 2, first + 1, 3), 2, 400, first, last)
      fun reads(): List<Int> {
        val out = mutableListOf(
          v.scrollX, v.scrollY, v.maxScrollY, v.contentWidth, v.contentHeight, v.textAreaLeft, v.textAreaWidth,
          v.wrapWidth, v.firstVisibleLine(), v.lastVisibleLine(), v.widestLine, v.viewX(0f).toInt(), v.rowTop(30),
        )
        for (line in first..last + 1) out += listOf(v.lineTop(line), v.rowStart(line))
        for (line in first..last) out += v.rows(line)
        for (gap in v.gaps()) out += listOf(gap.line, gap.top, gap.rows)
        return out
      }
      val drawn = reads()
      assertEquals(0, v.drawCalls)
      v.endDraw()
      assertEquals(reads(), drawn)
      assertEquals(listOf(2, 21, 50), v.gaps().map { it.line })
      v.close()
    }
  }

  // A draw reveals the caret before its measure call, when its copy has no tops yet. Reading the last draw's top there
  // puts the caret row off by the scroll since then, and the reveal jumps or misses.
  @Test
  fun aReadBeforeTheMeasureCallIgnoresTheLastDrawsTops() {
    lines(100).use { core ->
      val v = Viewport()
      v.attach(core)
      v.rowHeight = 10
      v.resize(100, 50)
      v.scrollTo(0, 100)
      v.beginDraw(checksCalls = false)
      v.measure(IntArray(0), 0, -1, 10, 16)
      v.endDraw()
      v.scrollTo(0, 300)
      v.beginDraw(checksCalls = false)
      v.measured(10, 1)
      assertEquals(10, v.rowStart(10))
      v.endDraw()
      v.close()
    }
  }

  // A measure call that lowers the end of the content under the scroll clamps it. The view tells the scroll listener
  // only when the call reports the move.
  @Test
  fun aMeasureCallReportsTheScrollItMoved() {
    lines(100).use { core ->
      val v = Viewport()
      v.attach(core)
      v.rowHeight = 10
      v.resize(100, 50)
      v.measured(98, 30)
      v.measured(99, 30)
      v.scrollTo(0, v.maxScrollY)
      val before = v.scrollY
      v.beginDraw(checksCalls = false)
      assertTrue(v.measure(intArrayOf(98, 1, 99, 1), 2, -1, 90, 99))
      v.endDraw()
      assertTrue("clamped from $before to ${v.scrollY}", v.scrollY < before)
      v.beginDraw(checksCalls = false)
      assertFalse(v.measure(IntArray(0), 0, -1, 90, 99))
      v.endDraw()
      v.close()
    }
  }

  // With the debug switch on, a ninth single layout call in one draw throws: a per-line crossing crept into the draw.
  @Test
  fun aNinthCallInsideADrawThrowsInDebug() {
    lines(100).use { core ->
      val v = Viewport()
      v.attach(core)
      v.rowHeight = 20
      v.resize(400, 200)
      v.beginDraw(checksCalls = true)
      v.measure(IntArray(0), 0, -1, 0, 11)
      repeat(Viewport.DRAW_CALL_LIMIT) { v.gapRows(50) }
      assertThrows(IllegalStateException::class.java) { v.gapRows(50) }
      v.endDraw()
      v.close()
    }
  }
}
