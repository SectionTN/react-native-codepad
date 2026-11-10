package me.sectiontn.codepad.layout

import java.util.Arrays

/**
 * Rows per line with lazily rebuilt prefix sums. Unmeasured lines count as one row, so every line has a
 * y position before layout and only moves once it is measured. Gap rows under a line count beside its wrap rows.
 */
class HeightMap(lineCount: Int) {
  private var rows = IntArray(maxOf(lineCount, 16)).also { Arrays.fill(it, 1) }
  private var gaps = IntArray(rows.size)
  private var gapLines = IntArray(0)
  private var starts = IntArray(rows.size + 1)
  private var cleanLines = 0

  var lineCount: Int = lineCount
    private set

  val totalRows: Int get() = rowStart(lineCount)

  fun rows(line: Int): Int = rows[line]

  fun gapRows(line: Int): Int = gaps[line]

  /** Replaces every gap: line to rows of empty space under it. Lines outside the map are ignored. */
  fun setGaps(next: Map<Int, Int>) {
    var dirty = lineCount
    for (line in gapLines) if ((next[line] ?: 0) != gaps[line]) dirty = minOf(dirty, line)
    for ((line, count) in next) if (line in 0 until lineCount && gaps[line] != count) dirty = minOf(dirty, line)
    if (dirty == lineCount) return
    for (line in gapLines) gaps[line] = 0
    val kept = ArrayList<Int>(next.size)
    for ((line, count) in next) {
      if (line in 0 until lineCount && count > 0) {
        gaps[line] = count
        kept.add(line)
      }
    }
    gapLines = kept.toIntArray()
    cleanLines = minOf(cleanLines, dirty + 1)
  }

  /** True when [row] is empty space under a line rather than one of its text rows. */
  fun isGapRow(row: Int): Boolean {
    if (row < 0 || row >= totalRows) return false
    val line = lineAtRow(row)
    return row >= rowStart(line) + rows[line]
  }

  /** Returns the previous count so the caller can keep the viewport anchored. */
  fun setRows(line: Int, count: Int): Int {
    val old = rows[line]
    if (old != count) {
      rows[line] = count
      cleanLines = minOf(cleanLines, line + 1)
    }
    return old
  }

  /** First row of [line]. line == lineCount yields the total row count. */
  fun rowStart(line: Int): Int {
    val l = line.coerceIn(0, lineCount)
    ensure(l)
    return starts[l]
  }

  fun lineAtRow(row: Int): Int {
    ensure(lineCount)
    val r = row.coerceIn(0, maxOf(starts[lineCount] - 1, 0))
    var lo = 0
    var hi = lineCount - 1
    while (lo < hi) {
      val mid = (lo + hi + 1) ushr 1
      if (starts[mid] <= r) lo = mid else hi = mid - 1
    }
    return lo
  }

  /** Lines [first, first + oldCount) became newCount fresh lines of one row each, without gaps. */
  fun replaceLines(first: Int, oldCount: Int, newCount: Int) {
    val tail = lineCount - first - oldCount
    val next = lineCount - oldCount + newCount
    if (next > rows.size) {
      rows = rows.copyOf(maxOf(next, rows.size * 2))
      gaps = gaps.copyOf(rows.size)
    }
    if (newCount != oldCount) {
      System.arraycopy(rows, first + oldCount, rows, first + newCount, tail)
      System.arraycopy(gaps, first + oldCount, gaps, first + newCount, tail)
    }
    Arrays.fill(rows, first, first + newCount, 1)
    Arrays.fill(gaps, first, first + newCount, 0)
    if (gapLines.isNotEmpty()) {
      gapLines = gapLines.filter { it < first || it >= first + oldCount }
        .map { if (it >= first + oldCount) it + newCount - oldCount else it }
        .toIntArray()
    }
    lineCount = next
    cleanLines = minOf(cleanLines, first + 1)
  }

  fun resetAll() {
    Arrays.fill(rows, 0, lineCount, 1)
    cleanLines = 0
  }

  private fun ensure(upTo: Int) {
    if (starts.size < lineCount + 1) starts = starts.copyOf(maxOf(lineCount + 1, starts.size * 2))
    if (cleanLines == 0) {
      starts[0] = 0
      cleanLines = 1
    }
    while (cleanLines <= upTo) {
      val i = cleanLines
      starts[i] = starts[i - 1] + rows[i - 1] + gaps[i - 1]
      cleanLines++
    }
  }
}
