import Foundation

/// Rows per line with lazily rebuilt prefix sums. Unmeasured lines count as one row, so every line has a
/// y position before layout and only moves once it is measured. Gap rows under a line count beside its wrap rows.
final class HeightMap {
  private var rows: [Int]
  private var gaps: [Int]
  private var gapLines: [Int] = []
  private var starts: [Int]
  private var cleanLines = 0
  private(set) var lineCount: Int

  init(lineCount: Int) {
    self.lineCount = lineCount
    rows = [Int](repeating: 1, count: max(lineCount, 16))
    gaps = [Int](repeating: 0, count: rows.count)
    starts = [Int](repeating: 0, count: rows.count + 1)
  }

  var totalRows: Int { rowStart(lineCount) }

  func rows(_ line: Int) -> Int {
    rows[line]
  }

  func gapRows(_ line: Int) -> Int {
    gaps[line]
  }

  /// Replaces every gap: line to rows of empty space under it. Lines outside the map are ignored.
  func setGaps(_ next: [Int: Int]) {
    var dirty = lineCount
    for line in gapLines where (next[line] ?? 0) != gaps[line] { dirty = min(dirty, line) }
    for (line, count) in next where line >= 0 && line < lineCount && gaps[line] != count { dirty = min(dirty, line) }
    if dirty == lineCount { return }
    for line in gapLines { gaps[line] = 0 }
    var kept: [Int] = []
    for (line, count) in next where line >= 0 && line < lineCount && count > 0 {
      gaps[line] = count
      kept.append(line)
    }
    gapLines = kept
    cleanLines = min(cleanLines, dirty + 1)
  }

  /// True when `row` is empty space under a line rather than one of its text rows.
  func isGapRow(_ row: Int) -> Bool {
    if row < 0 || row >= totalRows { return false }
    let line = lineAtRow(row)
    return row >= rowStart(line) + rows[line]
  }

  /// Returns the previous count so the caller can keep the viewport anchored.
  @discardableResult
  func setRows(_ line: Int, _ count: Int) -> Int {
    let old = rows[line]
    if old != count {
      rows[line] = count
      cleanLines = min(cleanLines, line + 1)
    }
    return old
  }

  /// First row of `line`. line == lineCount yields the total row count.
  func rowStart(_ line: Int) -> Int {
    let l = max(0, min(line, lineCount))
    ensure(l)
    return starts[l]
  }

  func lineAtRow(_ row: Int) -> Int {
    ensure(lineCount)
    let r = max(0, min(row, max(starts[lineCount] - 1, 0)))
    var lo = 0
    var hi = lineCount - 1
    while lo < hi {
      let mid = (lo + hi + 1) >> 1
      if starts[mid] <= r { lo = mid } else { hi = mid - 1 }
    }
    return lo
  }

  /// Lines [first, first + oldCount) became newCount fresh lines of one row each, without gaps.
  func replaceLines(first: Int, oldCount: Int, newCount: Int) {
    let tail = lineCount - first - oldCount
    let next = lineCount - oldCount + newCount
    if next > rows.count {
      rows += [Int](repeating: 1, count: max(next, rows.count * 2) - rows.count)
      gaps += [Int](repeating: 0, count: rows.count - gaps.count)
    }
    if newCount != oldCount && tail > 0 {
      let moved = Array(rows[(first + oldCount)..<(first + oldCount + tail)])
      rows.replaceSubrange((first + newCount)..<(first + newCount + tail), with: moved)
      let movedGaps = Array(gaps[(first + oldCount)..<(first + oldCount + tail)])
      gaps.replaceSubrange((first + newCount)..<(first + newCount + tail), with: movedGaps)
    }
    for i in first..<(first + newCount) {
      rows[i] = 1
      gaps[i] = 0
    }
    if !gapLines.isEmpty {
      var shifted: [Int] = []
      for line in gapLines where line < first || line >= first + oldCount {
        shifted.append(line >= first + oldCount ? line + newCount - oldCount : line)
      }
      gapLines = shifted
    }
    lineCount = next
    cleanLines = min(cleanLines, first + 1)
  }

  func resetAll() {
    for i in 0..<lineCount { rows[i] = 1 }
    cleanLines = 0
  }

  private func ensure(_ upTo: Int) {
    if starts.count < lineCount + 1 { starts += [Int](repeating: 0, count: max(lineCount + 1, starts.count * 2) - starts.count) }
    if cleanLines == 0 {
      starts[0] = 0
      cleanLines = 1
    }
    while cleanLines <= upTo {
      let i = cleanLines
      starts[i] = starts[i - 1] + rows[i - 1] + gaps[i - 1]
      cleanLines += 1
    }
  }
}
