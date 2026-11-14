package me.sectiontn.codepad.core

import org.junit.Assert.assertEquals
import org.junit.Test

class WordRangeTest {
  // A drag after a long press extends by the words the long press selects, so both use the core's classes:
  // U+0085 is Unicode white space and U+001C to U+001F are not.
  @Test
  fun theDragWordIsTheLongPressWord() {
    val core = EditorCore("a\u0085\u0085b c\u001C\u001Dd")
    for (offset in 0..core.document.length) {
      core.selectWordAt(offset)
      assertEquals("offset $offset", core.selection.range, core.wordRangeAt(offset))
    }
  }
}
