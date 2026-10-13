import Foundation

/// The runs of visible lines prepare must re-query, flat inclusive [lo, hi, ...]: a line with no entry or one older than
/// the applied snapshot, or, with `changed` given, one a changed region meets; without `changed` every line not at `revision`.
func dirtyRuns(
  first: Int, last: Int, revision: Int, applied: Int, changed: [Int]?, doc: Document, entryRevision: (Int) -> Int?
) -> [Int] {
  var out: [Int] = []
  var r = 0
  for line in first...last {
    let dirty: Bool
    if let entry = entryRevision(line) {
      if entry == revision {
        dirty = false
      } else if let changed, entry >= applied {
        let start = doc.lineStart(line)
        while r + 1 < changed.count && max(changed[r], changed[r + 1] - 1) < start { r += 2 }
        dirty = r + 1 < changed.count && changed[r] <= doc.lineEnd(line)
      } else {
        dirty = true
      }
    } else {
      dirty = true
    }
    if !dirty { continue }
    if let lastLine = out.last, lastLine == line - 1 {
      out[out.count - 1] = line
    } else {
      out.append(line)
      out.append(line)
    }
  }
  return out
}
