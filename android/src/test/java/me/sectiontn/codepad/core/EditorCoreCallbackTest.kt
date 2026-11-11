package me.sectiontn.codepad.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

// A listener throw must never cross the native frames that called it: it surfaces from the core call once the core
// returned, the edit is complete, and the core keeps working.
class EditorCoreCallbackTest {
  @Test
  fun aThrowingChangeListenerSurfacesAfterTheCallAndSkipsItsLaterCallbacks() {
    val core = EditorCore("ab")
    val selections = ArrayList<Selection>()
    core.onSelectionChange = { selections.add(it) }
    core.onChange = { _, _ -> throw IllegalStateException("change") }
    // Each typed unit reports its selection, then its change.
    val thrown = assertThrows(IllegalStateException::class.java) { core.typeText("xy") }
    assertEquals("change", thrown.message)
    assertEquals("xyab", core.document.text())
    assertEquals(Selection(2, 2), core.selection)
    assertEquals(listOf(Selection(1, 1)), selections)
    core.onChange = null
    core.typeText("z")
    assertEquals("xyzab", core.document.text())
    assertEquals(listOf(Selection(1, 1), Selection(3, 3)), selections)
    core.close()
  }

  @Test
  fun aThrowingSelectionListenerSurfacesAfterTheMove() {
    val core = EditorCore("ab")
    core.onSelectionChange = { throw IllegalArgumentException("selection") }
    val thrown = assertThrows(IllegalArgumentException::class.java) { core.setSelection(1, 1) }
    assertEquals("selection", thrown.message)
    assertEquals(Selection(1, 1), core.selection)
    core.onSelectionChange = null
    core.move(TextMovement.Unit.Char, forward = true, extend = false)
    assertEquals(Selection(2, 2), core.selection)
    core.close()
  }

  // A listener that edits again must not change what the outer edit returns.
  @Test
  fun aNestedEditInAListenerLeavesTheOuterChange() {
    val core = EditorCore("abc")
    var nested = false
    core.onChange = { _, _ ->
      if (!nested) {
        nested = true
        core.replace(2, 3, "Z")
      }
    }
    val change = core.replace(0, 1, "X")
    assertEquals(0, change.start)
    assertEquals("X", change.inserted)
    assertEquals("XbZ", core.document.text())
    core.close()
  }
}
