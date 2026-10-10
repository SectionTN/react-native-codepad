import Foundation

public enum BracketMatcher {
  private static let limit = 100_000

  public static func partnerOf(_ c: UInt16) -> UInt16? {
    switch c {
    case u16("("): return u16(")")
    case u16("["): return u16("]")
    case u16("{"): return u16("}")
    case u16(")"): return u16("(")
    case u16("]"): return u16("[")
    case u16("}"): return u16("{")
    default: return nil
    }
  }

  /// Returns (bracket at the caret, partner) or nil. The bracket after the caret is tried first, then the one
  /// before it. `skip` excludes offsets inside strings and comments once a syntax snapshot exists.
  public static func match(_ doc: Document, caret: Int, skip: ((Int) -> Bool)?) -> (Int, Int)? {
    let len = doc.length
    let at: Int
    if caret < len && partnerOf(doc.unit(at: caret)) != nil && skip?(caret) != true {
      at = caret
    } else if caret > 0 && partnerOf(doc.unit(at: caret - 1)) != nil && skip?(caret - 1) != true {
      at = caret - 1
    } else {
      return nil
    }
    let c = doc.unit(at: at)
    guard let partner = partnerOf(c) else { return nil }
    let step = (c == u16("(") || c == u16("[") || c == u16("{")) ? 1 : -1
    var depth = 0
    var i = at
    var steps = 0
    while i >= 0 && i < len && steps < limit {
      let ch = doc.unit(at: i)
      if (ch == c || ch == partner) && skip?(i) != true {
        if ch == c {
          depth += 1
        } else {
          depth -= 1
          if depth == 0 { return (at, i) }
        }
      }
      i += step
      steps += 1
    }
    return nil
  }
}
