package me.sectiontn.codepad.syntax

import me.sectiontn.codepad.core.Document
import org.junit.Assert.assertArrayEquals
import org.junit.Test

class DirtyLinesTest {
  private val doc = Document("let a = 1;\nlet b = 2;\nlet c = 3;\n")

  // The regression this design removes: every visible line re-queried for a one line edit.
  @Test
  fun anEditOnOneLineLeavesTheOtherVisibleLinesAlone() {
    assertArrayEquals(intArrayOf(1, 1), dirtyRuns(0, 2, 2, 1, intArrayOf(19, 20), doc) { 1 })
  }

  // A deletion's empty span and a region ending on a newline still name their line.
  @Test
  fun aRegionAtALineEndAndAnEmptyRegionDirtyTheirLines() {
    assertArrayEquals(intArrayOf(0, 0), dirtyRuns(0, 2, 2, 1, intArrayOf(10, 11), doc) { 1 })
    assertArrayEquals(intArrayOf(1, 1), dirtyRuns(0, 2, 2, 1, intArrayOf(11, 11), doc) { 1 })
    assertArrayEquals(intArrayOf(0, 2), dirtyRuns(0, 2, 2, 1, intArrayOf(5, 25), doc) { 1 })
    assertArrayEquals(intArrayOf(0, 0, 2, 2), dirtyRuns(0, 2, 2, 1, intArrayOf(3, 4, 30, 31), doc) { 1 })
  }

  // Lines the regions cannot vouch for: never laid out, laid out plain, or older than the applied snapshot; and no regions at all.
  @Test
  fun aMissingPlainOrOlderEntryIsDirtyWithoutARegion() {
    val revisions = mapOf(0 to null, 1 to -1, 2 to 0)
    assertArrayEquals(intArrayOf(0, 2), dirtyRuns(0, 2, 2, 1, IntArray(0), doc) { revisions[it] })
    assertArrayEquals(intArrayOf(0, 2), dirtyRuns(0, 2, 2, 1, null, doc) { 1 })
    assertArrayEquals(IntArray(0), dirtyRuns(0, 2, 2, 1, null, doc) { 2 })
  }
}
