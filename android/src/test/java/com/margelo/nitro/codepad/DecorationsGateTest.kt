package com.margelo.nitro.codepad

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// A checker that finds the same marks again sends an equal array with a newer revision, which must apply.
class DecorationsGateTest {
  private fun underline(start: Double, end: Double) = arrayOf(
    NativeDecoration(NativeDecorationKind.UNDERLINE, start, end, 0.0, 0.0, "#ff0000", NativeUnderlineStyle.SOLID, 1.0, 2.0),
  )

  @Test
  fun anEqualArrayWithANewRevisionApplies() {
    val gate = DecorationsGate()
    assertTrue(gate.admit(underline(10.0, 14.0), 3))
    assertTrue(gate.admit(underline(10.0, 14.0), 7))
  }

  @Test
  fun aRepeatOfArrayAndRevisionIsSkipped() {
    val gate = DecorationsGate()
    assertTrue(gate.admit(underline(10.0, 14.0), -1))
    assertFalse(gate.admit(underline(10.0, 14.0), -1))
  }

  @Test
  fun aForcedRepeatApplies() {
    val gate = DecorationsGate()
    assertTrue(gate.admit(underline(10.0, 14.0), -1))
    assertTrue(gate.admit(underline(10.0, 14.0), -1, force = true))
  }
}
