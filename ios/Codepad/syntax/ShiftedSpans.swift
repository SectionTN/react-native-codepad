import Foundation

/// A line's (startColumn, endColumn, styleId) triples after a change inside it replaced `removed` units at `start`
/// with `inserted` units: a span containing the edit, or ending at it with nothing removed, grows; one cut by it keeps
/// its parts before and after; later spans move. The parse replaces the guess one frame later.
func shiftSpans(_ spans: [Int], start: Int, removed: Int, inserted: Int) -> [Int] {
  let delta = inserted - removed
  let endR = start + removed
  var out: [Int] = []
  out.reserveCapacity(spans.count + 3)
  func add(_ s: Int, _ e: Int, _ style: Int) {
    if s < e {
      out.append(s)
      out.append(e)
      out.append(style)
    }
  }
  var i = 0
  while i + 2 < spans.count {
    let s = spans[i]
    let e = spans[i + 1]
    let style = spans[i + 2]
    i += 3
    if e < start || (e == start && removed > 0) {
      add(s, e, style)
    } else if s >= endR && !(s == start && removed == 0 && e == start) {
      add(s + delta, e + delta, style)
    } else if s < start && e >= endR {
      add(s, e + delta, style)
    } else if e == start {
      add(s, e + delta, style)
    } else {
      if s < start { add(s, start, style) }
      if e > endR { add(endR + delta, e + delta, style) }
    }
  }
  return out
}
