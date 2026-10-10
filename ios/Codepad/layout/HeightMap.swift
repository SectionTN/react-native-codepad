import Foundation

/// Rows per line with lazily rebuilt prefix sums. Unmeasured lines count as one row, so every line has a
/// y position before layout and only moves once it is measured.
final class HeightMap {
  private var rows: [Int]
  private var starts: [Int]
  private var cleanLines = 0
  private(set) var lineCount: Int

  init(lineCount: Int) {
    self.lineCount = lineCount
    rows = [Int](repeating: 1, count: max(lineCount, 16))
    starts = [Int](repeating: 0, count: rows.count + 1)
  }

  var totalRows: Int { rowStart(lineCount) }

  func rows(_ line: Int) -> Int {
    rows[line]
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

  /// Lines [first, first + oldCount) became newCount fresh lines of one row each.
  func replaceLines(first: Int, oldCount: Int, newCount: Int) {
    let tail = lineCount - first - oldCount
    let next = lineCount - oldCount + newCount
    if next > rows.count { rows += [Int](repeating: 1, count: max(next, rows.count * 2) - rows.count) }
    if newCount != oldCount && tail > 0 {
      let moved = Array(rows[(first + oldCount)..<(first + oldCount + tail)])
      rows.replaceSubrange((first + newCount)..<(first + newCount + tail), with: moved)
    }
    for i in first..<(first + newCount) { rows[i] = 1 }
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
      starts[i] = starts[i - 1] + rows[i - 1]
      cleanLines += 1
    }
  }
}
