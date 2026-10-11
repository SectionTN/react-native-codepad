/// Sorts unit pairs by start and merges the ones that overlap or touch, so a burst of edits stays one region.
func coalesce(_ pairs: [Int]) -> [Int] {
  if pairs.count <= 2 { return pairs }
  let order = stride(from: 0, to: pairs.count - 1, by: 2).sorted { pairs[$0] < pairs[$1] }
  var out: [Int] = []
  out.reserveCapacity(pairs.count)
  for i in order {
    let s = pairs[i]
    let e = pairs[i + 1]
    if let last = out.last, s <= last {
      if e > last { out[out.count - 1] = e }
    } else {
      out.append(s)
      out.append(e)
    }
  }
  return out
}
