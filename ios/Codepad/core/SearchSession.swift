import Foundation

/// The compiled query and its matches for one document revision, packed as start and end pairs.
public final class SearchSession {
  public let query: SearchQuery
  public let pattern: NSRegularExpression
  public var matches: [Int] = []
  public var revision = -1

  public init(query: SearchQuery, pattern: NSRegularExpression) {
    self.query = query
    self.pattern = pattern
  }

  public var count: Int { matches.count / 2 }

  /// Index of the first match starting at or after `offset`, else `count`.
  public func indexAtOrAfter(_ offset: Int) -> Int {
    var lo = 0
    var hi = count
    while lo < hi {
      let mid = (lo + hi) >> 1
      if matches[mid * 2] < offset { lo = mid + 1 } else { hi = mid }
    }
    return lo
  }

  /// Index of the match equal to `range`, else -1.
  public func indexOf(_ range: TextRange) -> Int {
    let i = indexAtOrAfter(range.start)
    return i < count && matches[i * 2] == range.start && matches[i * 2 + 1] == range.end ? i : -1
  }

  /// The match after `selection`, skipping the selected one, wrapping to the first; -1 without matches.
  public func nextIndex(_ selection: Selection) -> Int {
    if count == 0 { return -1 }
    var index = indexAtOrAfter(selection.min)
    if index < count && matches[index * 2] == selection.min && matches[index * 2 + 1] == selection.max { index += 1 }
    return index >= count ? 0 : index
  }

  /// The match before `selection`, wrapping to the last; -1 without matches.
  public func previousIndex(_ selection: Selection) -> Int {
    if count == 0 { return -1 }
    let index = indexAtOrAfter(selection.min) - 1
    return index < 0 ? count - 1 : index
  }

  /// Shifts the pairs past `change` and drops the ones it touched.
  public static func mapThrough(_ matches: [Int], _ change: Change) -> [Int] {
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
  public static func firstEndingAfter(_ matches: [Int], _ offset: Int) -> Int {
    var lo = 0
    var hi = matches.count / 2
    while lo < hi {
      let mid = (lo + hi) >> 1
      if matches[mid * 2 + 1] <= offset { lo = mid + 1 } else { hi = mid }
    }
    return lo
  }
}
