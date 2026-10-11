package me.sectiontn.codepad.view

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GestureMachineTest {
  private class FakeHost : GestureMachine.Host {
    val calls = ArrayList<String>()
    var handle: GestureMachine.Handle? = null
    var scrollable = true
    var selected: IntRange = IntRange.EMPTY

    override fun offsetAt(x: Float, y: Float): Int = x.toInt()
    override fun handleAt(x: Float, y: Float): GestureMachine.Handle? = handle
    override fun insideSelection(offset: Int): Boolean = offset in selected
    override fun canScroll(dx: Float, dy: Float): Boolean = scrollable
    override fun placeCaret(offset: Int) { calls.add("caret $offset") }
    override fun selectWord(offset: Int) { calls.add("word $offset") }
    override fun extendWords(offset: Int) { calls.add("extend $offset") }
    override fun moveHandle(handle: GestureMachine.Handle, x: Float, y: Float) { calls.add("handle $handle ${x.toInt()}") }
    override fun endHandleDrag() { calls.add("handle end") }
    override fun beginScroll() { calls.add("scroll begin") }
    override fun scrollBy(dx: Float, dy: Float) { calls.add("scroll ${dx.toInt()} ${dy.toInt()}") }
    override fun endScroll(velocityX: Float, velocityY: Float) { calls.add("scroll end ${velocityX.toInt()} ${velocityY.toInt()}") }
    override fun showMenu() { calls.add("menu") }
    override fun disallowIntercept() { calls.add("disallow") }
    override fun postLongPress(delayMs: Long) { calls.add("timer $delayMs") }
    override fun cancelLongPress() { calls.add("cancel") }
  }

  private val config = GestureMachine.Config(touchSlop = 8f, doubleTapSlop = 40f, doubleTapTimeout = 300, longPressTimeout = 400)

  private fun machine(host: FakeHost) = GestureMachine(host, config)

  @Test
  fun tapPlacesTheCaret() {
    val h = FakeHost()
    val m = machine(h)
    m.down(100f, 10f, 0)
    m.move(103f, 12f, 20)
    m.up(103f, 12f, 50, 0f, 0f)
    assertEquals(listOf("timer 400", "cancel", "caret 103"), h.calls)
    val selected = FakeHost()
    selected.selected = 90..120
    val inside = machine(selected)
    inside.down(100f, 10f, 0)
    inside.up(100f, 10f, 50, 0f, 0f)
    assertEquals(listOf("timer 400", "cancel", "menu"), selected.calls)
  }

  @Test
  fun secondTapInsideTheWindowSelectsTheWord() {
    val h = FakeHost()
    val m = machine(h)
    m.down(100f, 10f, 0)
    m.up(100f, 10f, 50, 0f, 0f)
    m.down(105f, 12f, 200)
    m.up(105f, 12f, 240, 0f, 0f)
    assertEquals("word 105", h.calls.last())
    m.down(105f, 12f, 400)
    m.up(105f, 12f, 450, 0f, 0f)
    assertEquals("caret 105", h.calls.last())
    m.down(105f, 12f, 1000)
    m.up(105f, 12f, 1050, 0f, 0f)
    assertEquals("caret 105", h.calls.last())
  }

  @Test
  fun dragScrollsAndFlings() {
    val h = FakeHost()
    val m = machine(h)
    m.down(100f, 100f, 0)
    m.move(100f, 95f, 10)
    assertFalse(h.calls.any { it.startsWith("scroll") })
    m.move(100f, 80f, 20)
    m.move(100f, 60f, 30)
    m.up(100f, 60f, 40, 0f, -3000f)
    assertEquals(
      listOf("timer 400", "cancel", "disallow", "scroll begin", "scroll 0 15", "scroll 0 20", "cancel", "scroll end 0 -3000"),
      h.calls,
    )
  }

  @Test
  fun dragLeavesTheGestureToTheParentWhenItCannotScroll() {
    val h = FakeHost()
    h.scrollable = false
    val m = machine(h)
    m.down(100f, 100f, 0)
    m.move(100f, 60f, 20)
    m.up(100f, 60f, 40, 0f, -3000f)
    assertEquals(listOf("timer 400", "cancel", "cancel"), h.calls)
  }

  @Test
  fun longPressSelectsThenExtendsByWords() {
    val h = FakeHost()
    val m = machine(h)
    m.down(100f, 10f, 0)
    m.longPress()
    assertEquals(listOf("timer 400", "disallow", "word 100", "menu"), h.calls)
    m.move(104f, 10f, 500)
    assertEquals(4, h.calls.size)
    m.move(130f, 10f, 520)
    assertEquals("extend 130", h.calls.last())
    m.up(130f, 10f, 600, 0f, 0f)
    assertEquals("menu", h.calls.last())
  }

  @Test
  fun handleDragMovesTheHandle() {
    val h = FakeHost()
    h.handle = GestureMachine.Handle.End
    val m = machine(h)
    m.down(100f, 10f, 0)
    m.move(120f, 10f, 10)
    m.up(120f, 10f, 20, 0f, 0f)
    assertEquals(listOf("disallow", "handle End 120", "cancel", "handle end"), h.calls)
  }

  @Test
  fun cancelEndsAScroll() {
    val h = FakeHost()
    val m = machine(h)
    m.down(100f, 100f, 0)
    m.move(100f, 50f, 20)
    m.cancel()
    assertEquals("scroll end 0 0", h.calls.last())
    m.down(100f, 100f, 100)
    m.up(100f, 100f, 150, 0f, 0f)
    assertEquals("caret 100", h.calls.last())
  }
}
