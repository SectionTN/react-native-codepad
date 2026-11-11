package me.sectiontn.codepad.core

import kotlin.random.Random
import org.junit.Assert.assertEquals
import org.junit.Test

// The Kotlin decoder of cp_editor_frame against plain document reads, through seeded edits and buffers that start
// too small, so a misread offset, a dropped run line or a stale grown buffer fails here.
class EditorFrameTest {
  @Test
  fun aFrameReadsWhatTheDocumentReads() {
    val random = Random(7)
    val core = EditorCore("fun a() {\n  return 1\n}\n\nval b = 2\n")
    val reader = FrameReader(ints = 1, units = 1)
    val pieces = listOf("x", "\n", "ab\ncd", "", "\n\n", "é😀", "  ")
    repeat(500) {
      val doc = core.document
      val a = random.nextInt(doc.length + 1)
      val b = minOf(doc.length, a + random.nextInt(4))
      core.replace(a, b, pieces[random.nextInt(pieces.size)])
      if (random.nextInt(3) == 0) core.setSelection(random.nextInt(doc.length + 1), random.nextInt(doc.length + 1))
      val first = random.nextInt(doc.lineCount + 2) - 1
      val last = first + random.nextInt(6)
      val entries = IntArray(last - first + 1) { EditorFrame.NO_ENTRY }
      val frame = reader.read(core, 0L, first, last, -1, false, entries)
      assertEquals(doc.revision, frame.revision)
      assertEquals(doc.length, frame.length)
      assertEquals(doc.lineCount, frame.lineCount)
      assertEquals(core.selection, Selection(frame.anchor, frame.head))
      assertEquals(doc.lineAt(core.selection.head), frame.caretLine)
      assertEquals(first.coerceIn(0, doc.lineCount - 1), frame.first)
      for (line in frame.first..frame.last) {
        assertEquals(doc.lineStart(line), frame.lineStart(line))
        assertEquals(doc.lineLength(line), frame.lineLength(line))
        assertEquals(line, frame.lineAt(doc.lineStart(line)))
        assertEquals(doc.line(line).toString(), frame.text(line))
      }
      assertEquals(doc.lineStart(frame.last + 1), frame.lineStart(frame.last + 1))
      assertEquals(null, frame.lineStart(frame.last + 2))
    }
    core.close()
  }
}
