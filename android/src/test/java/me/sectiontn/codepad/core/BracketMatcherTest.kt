package me.sectiontn.codepad.core

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BracketMatcherTest {
  @Test
  fun scanStopsAtTheStepLimit() {
    val inside = "x".repeat(100_000)
    assertNull(BracketMatcher.match(Document("($inside)"), 0, null))
    assertArrayEquals(intArrayOf(0, 99_999), BracketMatcher.match(Document("(" + "x".repeat(99_998) + ")"), 0, null))
  }

  @Test
  fun skipIsAskedOnlyForBracketCharacters() {
    val doc = Document("a(b c)d")
    val asked = ArrayList<Int>()
    BracketMatcher.match(doc, 1) {
      asked.add(it)
      false
    }
    assertTrue(asked.isNotEmpty())
    assertTrue(asked.all { doc.charAt(it) == '(' || doc.charAt(it) == ')' })
  }
}
