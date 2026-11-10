import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// A line's (startColumn, endColumn, styleId) triples after a change inside it, painted until the parse lands.
func shiftSpans(_ spans: [Int], start: Int, removed: Int, inserted: Int) -> [Int] {
  let input = spans.map { Int32($0) }
  var out = [Int32](repeating: 0, count: input.count + 3)
  let count = input.withUnsafeBufferPointer { s in
    cp_shift_spans(s.baseAddress, UInt32(s.count), Int32(start), Int32(removed), Int32(inserted), &out, UInt32(out.count))
  }
  return out.prefix(Int(count)).map { Int($0) }
}
