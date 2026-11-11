import Foundation

/// The painted matches: the core owns the search, the view keeps the last result and shifts it through edits.
enum SearchSession {
  /// Shifts the pairs past `change` and drops the ones it touched.
  static func mapThrough(_ matches: [Int], _ change: Change) -> [Int] {
    var out: [Int] = []
    out.reserveCapacity(matches.count)
    var i = 0
    while i < matches.count {
      let s = matches[i]
      let e = matches[i + 1]
      if e <= change.start {
        out.append(s)
        out.append(e)
      } else if s >= change.end {
        out.append(s + change.delta)
        out.append(e + change.delta)
      }
      i += 2
    }
    return out
  }

  /// Index of the first match ending after `offset`, else the count.
  static func firstEndingAfter(_ matches: [Int], _ offset: Int) -> Int {
    var lo = 0
    var hi = matches.count / 2
    while lo < hi {
      let mid = (lo + hi) >> 1
      if matches[mid * 2 + 1] <= offset { lo = mid + 1 } else { hi = mid }
    }
    return lo
  }
}
